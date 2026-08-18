# Production Readiness Guide

A checklist for deploying super-http in production environments.

---

## Connection pool

```typescript
createClient({
  baseURL: '...',
  pool: {
    maxSockets: 200,          // ✓ burst headroom, not average load (see below)
    maxFreeSockets: 50,       // ✓ keep ~25% of maxSockets as idle
    keepAlive: true,          // ✓ always true in production
    keepAliveMsecs: 1000,     // ✓ match upstream keep-alive timeout / 2
    timeout: 30_000,          // ✓ response timeout
    socketTimeoutMs: 30_000,  // ✓ socket inactivity timeout on the agent
    maxContentLength: 32 * 1024 * 1024,  // ✓ cap the response body
  },
})
```

::: warning
Never leave `timeout` at `Infinity`. A hung upstream will block the connection forever and exhaust your pool silently.
:::

**Sizing `maxSockets`.** Steady-state demand is `rps × latencySeconds` (Little's
Law): 58 rps at 200 ms is about **12 sockets**. So the number you pick is not about
average throughput — it is headroom for when latency degrades. If your p99 goes to
2 s, the same 58 rps wants ~116 sockets.

- Compute the steady-state figure, then size for your worst plausible latency
- If you see `ECONNRESET` bursts, increase `maxFreeSockets`
- `client.state()` reports live in-flight counts when a bulkhead is configured

**`timeout` vs `socketTimeoutMs`.** `timeout` is the axios response timeout — how
long to wait for an answer. `socketTimeoutMs` goes to the agent and bounds socket
inactivity, which is what catches a connection silently dropped by a NAT or
firewall. Node's agent exposes no separate connect timeout, so inactivity covers
that case too.

::: tip New in 2.0
`maxContentLength` and `maxBodyLength` default to 32 MiB. Axios itself defaults to
unlimited, so before 2.0 a runaway upstream could exhaust the client's memory.
:::

---

## Total deadlines

Set one. `timeout` bounds a single attempt, so with retries and queueing a call has
no upper bound you can state:

```typescript
const api = createClient({ baseURL: '...', preset: 'resilient-api' })
api.deadline(5_000)   // queue waits + all attempts + all backoff, combined
```

Without a deadline, the `resilient-api` preset admits a worst case of roughly 76 s
for one `await`. See [Deadlines & Cancellation](./deadlines).

---

## Retry — safe vs unsafe

From 2.0 the library enforces this instead of leaving it to you: ambiguous errors
are retried only for idempotent methods. You no longer have to remember to disable
retry on `POST`.

```typescript
// Safe by default — POST is not retried on a timeout or a 5xx
api.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
```

**What the error proves matters more than whether it looks transient:**
- ✅ `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN` — the request never ran, safe for any method
- ⚠️ `ECONNRESET`, `ETIMEDOUT`, `ECONNABORTED`, `EPIPE`, HTTP 5xx — may already have
  been applied; idempotent methods only
- ❌ HTTP 4xx — never retry (client error)
- ❌ Business logic errors — never retry

Axios reports its own timeout as `ETIMEDOUT`/`ECONNABORTED`, which is why a
timed-out `POST` is the dangerous case and not an exotic one.

**When you do need to retry a write**, pair the opt-in with an idempotency key so
the *server* makes it safe:

```typescript
const charge = await api.request({
  url: '/charges',
  method: 'post',
  data: payload,
  headers: { 'Idempotency-Key': chargeId },
  policy: { retry: { attempts: 3, retryNonIdempotent: true } },
})
```

Use exponential jitter, not a fixed delay. `retry(n, ms)` with a number is a fixed
delay by design — many clients failing together then retry in lockstep.

---

## Circuit breaker tuning

| Service type | `failureThreshold` | `timeoutMs` | `successThreshold` |
|---|---|---|---|
| Critical / slow to recover | 10 | 30 000 | 5 |
| Standard external API | 5–10 | 10 000 | 2–3 |
| Non-critical / optional | 2–3 | 5 000 | 1 |
| Internal microservice | 20+ | 5 000 | 3 |

::: tip
For services with **partial failure** (30% error rate), use a high `failureThreshold` (≥ 20) so the CB doesn't trip on statistical noise. Circuit breakers shine for **catastrophic failure** (70%+ error rate).
:::

`failureThreshold` counts **consecutive** failures — any success resets the streak
— and only network errors and 5xx count. A burst of 404s or 401s from a healthy
upstream will not open the circuit. Override with `shouldTrip` if you need
different accounting.

Alert on the live state, not only the cumulative counter:

```typescript
setInterval(() => {
  const s = api.state()
  gauge('http.circuit.open', s.circuit?.open ? 1 : 0)
}, 10_000)
```

---

## Bulkhead sizing

```typescript
client.bulkhead({
  maxConcurrent: N,          // see sizing guide below
  maxQueue: N * 3,           // queue 3× the active slots
  queueTimeoutMs: 3_000,     // fail queued requests after 3 s
})
```

**Sizing `maxConcurrent`:**
- = average upstream response time (ms) × desired RPS / 1000
- Example: 50ms avg × 200 RPS / 1000 = **10 concurrent**
- Add 50% headroom: **15 concurrent**

`queueTimeoutMs` defaults to 10 s. Leaving it out no longer means waiting forever,
but set it deliberately to something your caller can live with — and remember a
retry backoff does **not** hold a slot, so the queue drains while a failing request
sleeps.

---

## Rate limiter

Always leave headroom below the upstream limit to account for:
- Clock drift between instances
- Other services sharing the same API key
- Burst behaviour at window boundaries

```typescript
// Upstream limit: 1000 req/min → configure 850 (15% headroom)
client.rateLimit({ permitLimit: 850, windowMs: 60_000 })
```

Retry attempts take tokens too, so `permitLimit` bounds what actually leaves your
process rather than how many calls you make. This is a fixed-window limiter, which
permits up to `2 × permitLimit` across a boundary — that burst is part of why the
headroom matters.

---

## Observability in production

```typescript
import { createClient, LoggerPlugin, MetricsReporterPlugin } from 'super-http'

const api = createClient({ baseURL: '...', preset: 'resilient-api' })

// Structured logs
api.use(LoggerPlugin({ prefix: `[${serviceName}]`, level: 'info' }))

// Metrics every 60 s
api.use(MetricsReporterPlugin({ intervalMs: 60_000 }))

// Alert on circuit opens
api.on({
  onCircuitStateChange: ({ from, to, failures }) => {
    if (to === 'open') {
      alerting.send(`[CRITICAL] ${serviceName} circuit opened after ${failures} failures`)
    }
  },
})
```

**Metrics to alert on:**
- `circuitBreakerTrips > 0` → circuit is tripping, upstream degraded
- `failed / requests > 0.05` → >5% error rate
- `p99Latency > SLO * 0.8` → approaching latency SLO
- `bulkheadRejects > 0` → backpressure, consider scaling

---

## Fallback strategy

Design fallbacks to be **safe, fast, and observable**:

```typescript
api
  .fallback(async (error) => {
    // 1. Log the fallback (so you know it's happening)
    logger.warn('Falling back to cache', { error })

    // 2. Try a secondary source
    const cached = await cache.get('last-known-good')
    if (cached) return { data: cached, degraded: true }

    // 3. Return a safe default — never throw from fallback
    return { data: [], degraded: true }
  })
  .on({ onFallback: () => metrics.increment('fallback.triggered') })
```

::: warning
**Never** let a fallback throw an error — it defeats the purpose. If the secondary source also fails, return a safe default.
:::

---

## Shutting down cleanly

`close()` destroys both agents' sockets and clears plugin timers. Dropping the
reference is not enough — keep-alive sockets stay open until the remote or the OS
closes them.

```typescript
process.on('SIGTERM', async () => {
  await api.close()
  server.close()
})
```

`HttpClientFactory.clear()` closes each client before dropping it, which matters in
tests and in hot-reload flows.

---

## Production checklist

- [ ] `timeout` is set and not `Infinity`
- [ ] `client.deadline(ms)` bounds the total call, not just one attempt
- [ ] `socketTimeoutMs` set, so a silently-dropped connection is detected
- [ ] `maxContentLength` sized for your largest legitimate response
- [ ] `keepAlive: true` in pool config
- [ ] `maxSockets` sized for burst headroom, not average load
- [ ] Writes that are retried carry an `Idempotency-Key`
- [ ] Retry uses exponential jitter (not fixed delay)
- [ ] Circuit breaker threshold tuned for the error profile
- [ ] Bulkhead and rate limiter queue timeouts are values you chose
- [ ] Rate limiter has headroom below upstream limit
- [ ] `onCircuitStateChange` fires an alert
- [ ] `client.state()` is polled for live circuit/queue state
- [ ] `client.metrics()` is scraped by your metrics system
- [ ] `client.correlate()` is on, so retries are traceable to a request
- [ ] Fallback returns a safe default and never throws
- [ ] `close()` is called on shutdown
- [ ] `.dedup()` is only enabled on clients that read

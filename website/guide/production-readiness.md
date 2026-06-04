# Production Readiness Guide

A checklist for deploying super-http in production environments.

---

## Connection pool

```typescript
createClient({
  baseURL: '...',
  pool: {
    maxSockets: 50,        // ✓ size to your expected concurrency × 2
    maxFreeSockets: 10,    // ✓ keep ~20% of maxSockets as idle
    keepAlive: true,       // ✓ always true in production
    keepAliveMsecs: 1000,  // ✓ match upstream keep-alive timeout / 2
    timeout: 30_000,       // ✓ set a realistic worst-case timeout
  },
})
```

::: warning
Never leave `timeout` at `Infinity`. A hung upstream will block the connection forever and exhaust your pool silently.
:::

**Sizing `maxSockets`:**
- Start at `concurrency × 1.5` (e.g. 30 concurrent → maxSockets: 50)
- If you see `ECONNRESET` bursts, increase `maxFreeSockets`
- Monitor `client.metrics().requests` to validate actual concurrency

---

## Retry — safe vs unsafe

Only retry **idempotent** operations. Retrying a non-idempotent request can cause duplicate charges, double emails, etc.

```typescript
// ✅ Safe to retry
api.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))

// ⚠️ Payment endpoint — disable retry or use idempotency keys
const payment = await api.post('/charges', payload, {
  policy: { retry: false },
  headers: { 'Idempotency-Key': uuid() },
})
```

**Retry on the right errors:**
- ✅ `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED` — always safe to retry
- ✅ HTTP 5xx — usually safe for GETs, unsafe for POSTs without idempotency
- ❌ HTTP 4xx — never retry (client error)
- ❌ Business logic errors — never retry

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

## Production checklist

- [ ] `timeout` is set and not `Infinity`
- [ ] `keepAlive: true` in pool config
- [ ] `maxSockets` sized to expected concurrency
- [ ] Retry is only enabled for idempotent operations
- [ ] Retry uses exponential jitter (not fixed delay)
- [ ] Circuit breaker threshold tuned for the error profile
- [ ] Bulkhead `queueTimeoutMs` prevents indefinite queuing
- [ ] Rate limiter has headroom below upstream limit
- [ ] `onCircuitStateChange` fires an alert
- [ ] `client.metrics()` is scraped by your metrics system
- [ ] Fallback returns a safe default and never throws
- [ ] Payment/mutating endpoints use `policy: { retry: false }` or idempotency keys

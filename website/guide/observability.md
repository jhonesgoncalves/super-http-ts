# Observability

super-http provides three layers of observability out of the box: lifecycle hooks, resilience event hooks, and built-in metrics.

---

## Lifecycle hooks

Fire on every HTTP request, regardless of resilience policies:

```typescript
client.on({
  onRequest:  (config)   => logger.debug(`→ ${config.method} ${config.url}`),
  onResponse: (response) => logger.debug(`← ${response.status}`),
  onError:    (error)    => logger.error('request failed', error),
})
```

| Hook | When |
|---|---|
| `onRequest` | Just before the HTTP call (after all policies) |
| `onResponse` | On successful response |
| `onError` | When a request ultimately fails (after retries) |

---

## Resilience hooks

```typescript
client.on({
  onRetry:              ({ attempt, error, delayMs, requestId }) => { /* ... */ },
  onCircuitStateChange: ({ from, to, failures })                 => { /* ... */ },
  onBulkheadReject:     ({ active, queued, requestId })          => { /* ... */ },
  onFallback:           ({ error, requestId })                   => { /* ... */ },
  onRateLimitReject:    ({ permitLimit, windowMs, requestId })   => { /* ... */ },
})
```

Handlers **accumulate**: calling `on()` twice for the same hook registers both,
and all of them run. One throwing handler neither breaks the request nor stops the
others.

::: warning Changed in 2.0
In 1.x each `on()` overwrote the previous handler for that key, so two plugins
observing `onRetry` meant only the second one ever ran.
:::

See the full [ResilienceEvents reference](../api/resilience-events).

---

## Correlation ids

Events are anonymous until you turn correlation on. With it, every event carries
the id of the request that produced it, and the id is sent upstream in a header:

```typescript
client.correlate()                              // x-request-id, uuid v4
client.correlate({ header: 'x-trace-id' })      // custom header
client.correlate({ generate: () => ctx.traceId })  // reuse your own trace id

client.on({
  onRetry: ({ requestId, attempt, error }) =>
    logger.warn({ requestId, attempt, err: error }, 'retrying'),
})
```

All attempts of one logical call share the same id, so a retry storm is one id
repeated rather than N unrelated lines. A caller-supplied header is never
overwritten:

```typescript
await client.get('/users', { headers: { 'x-request-id': incomingId } })
// propagates incomingId instead of generating a new one
```

---

## Current state

`metrics()` is cumulative; `state()` is what is true **right now**. An alert needs
the second one:

```typescript
const s = client.state()

s.circuit?.open          // is the circuit open at this instant
s.circuit?.state         // 'closed' | 'open' | 'half-open'
s.policyCircuits         // breakers created by per-request policy overrides
s.bulkhead?.active       // in-flight
s.bulkhead?.queued       // waiting for a slot
s.rateLimit?.available   // tokens left in this window
s.rateLimit?.queued      // waiting for a token
s.dedup?.inFlight        // coalesced requests in flight
```

Components that are not configured are omitted, so `state().bulkhead` is
`undefined` unless you called `bulkhead()`.

---

## Built-in metrics

`client.metrics()` returns a point-in-time snapshot — no external setup required:

```typescript
const m = client.metrics()

// m.requests             — total dispatched
// m.success              — succeeded
// m.failed               — failed (after all retries)
// m.retries              — retry attempts fired
// m.circuitBreakerTrips  — circuit opened N times
// m.bulkheadRejects      — rejected by bulkhead
// m.rateLimitRejects     — rejected by rate limiter
// m.fallbacks            — fallback handler invoked
// m.avgLatency           — average response time (ms)
// m.p50Latency           — median (ms)
// m.p95Latency           — 95th percentile (ms)
// m.p99Latency           — 99th percentile (ms)
// m.uptime               — ms since client created (or since resetMetrics())
```

`avgLatency` covers every successful request. The percentiles are computed over a
rolling window of the most recent 2048 successes, so they track current behaviour
rather than the whole process lifetime — which is what you want an alert to fire
on. Memory is constant (16 KB per client) regardless of traffic volume.

See the full [MetricsSnapshot reference](../api/metrics).

---

## Sending metrics to Prometheus

```typescript
import { createClient } from 'super-http'
import { register, Counter, Histogram, Gauge } from 'prom-client'

const httpRetries  = new Counter({ name: 'http_retries_total', labelNames: ['attempt'] })
const httpLatency  = new Histogram({ name: 'http_latency_ms', buckets: [5,10,25,50,100,250,500] })
const circuitGauge = new Gauge({ name: 'http_circuit_open', labelNames: ['service'] })

const api = createClient({ baseURL: 'https://api.example.com' })

api.on({
  onRetry: ({ attempt, delayMs }) => {
    httpRetries.labels({ attempt: String(attempt) }).inc()
  },
  onResponse: (res) => {
    const latency = Date.now() - (res.config as any).__t0
    if (latency) httpLatency.observe(latency)
  },
  onCircuitStateChange: ({ to }) => {
    circuitGauge.labels({ service: 'api' }).set(to === 'open' ? 1 : 0)
  },
})
```

---

## Sending to Datadog

```typescript
api.on({
  onRetry:              ({ attempt }) => ddMetrics.increment('http.retry', 1, [`attempt:${attempt}`]),
  onCircuitStateChange: ({ to })      => ddMetrics.gauge('http.circuit.open', to === 'open' ? 1 : 0),
  onBulkheadReject:     ()            => ddMetrics.increment('http.bulkhead.rejected'),
  onFallback:           ()            => ddMetrics.increment('http.fallback'),
  onRateLimitReject:    ()            => ddMetrics.increment('http.rate_limit.rejected'),
})
```

---

## Plugins

For plug-and-play observability, use the built-in plugins:

```typescript
import { LoggerPlugin, MetricsReporterPlugin } from 'super-http'

api.use(LoggerPlugin({ prefix: '[my-service]', level: 'info' }))
api.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
```

Plugins may define `uninstall()` to release timers and listeners; `client.close()`
calls it. `MetricsReporterPlugin` uses it to clear its interval.

See the [Plugins guide](./plugins) for writing custom plugins for OTel, Datadog, etc.

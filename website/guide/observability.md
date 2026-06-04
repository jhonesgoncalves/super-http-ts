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
  onRetry:              ({ attempt, error, delayMs }) => { /* ... */ },
  onCircuitStateChange: ({ from, to, failures })      => { /* ... */ },
  onBulkheadReject:     ({ active, queued })           => { /* ... */ },
  onFallback:           ({ error })                   => { /* ... */ },
  onRateLimitReject:    ({ permitLimit, windowMs })   => { /* ... */ },
})
```

See the full [ResilienceEvents reference](../api/resilience-events).

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
// m.uptime               — ms since client created
```

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

See the [Plugins guide](./plugins) for writing custom plugins for OTel, Datadog, etc.

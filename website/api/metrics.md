# MetricsSnapshot

Returned by [`client.metrics()`](./http-client#metrics).

```typescript
import type { MetricsSnapshot } from 'super-http'
```

---

## Interface

```typescript
interface MetricsSnapshot {
  requests:             number  // total logical requests dispatched
  success:              number  // completed successfully
  failed:               number  // failed after all retry attempts
  retries:              number  // total retry attempts fired
  circuitBreakerTrips:  number  // times circuit transitioned to open
  bulkheadRejects:      number  // requests rejected by bulkhead
  rateLimitRejects:     number  // requests rejected by rate limiter
  fallbacks:            number  // times fallback handler invoked
  avgLatency:           number  // average response time (ms, successful only)
  p50Latency:           number  // median latency (ms), recent-request window
  p95Latency:           number  // 95th percentile (ms), recent-request window
  p99Latency:           number  // 99th percentile (ms), recent-request window
  uptime:               number  // ms since creation (or since resetMetrics())
}
```

---

## Usage

```typescript
const m = client.metrics()

console.log(`
  Requests: ${m.requests}  ✓ ${m.success}  ✗ ${m.failed}
  Latency:  avg=${m.avgLatency}ms  p95=${m.p95Latency}ms  p99=${m.p99Latency}ms
  Retries:  ${m.retries}
  CB trips: ${m.circuitBreakerTrips}
`)
```

---

## Alerting thresholds

| Metric | Alert when |
|---|---|
| `circuitBreakerTrips` | `> 0` per interval |
| `failed / requests` | `> 0.05` (5% error rate) |
| `p99Latency` | `> SLO × 0.8` |
| `bulkheadRejects` | `> 0` (backpressure forming) |

---

## Resetting

```typescript
client.resetMetrics()  // clears all counters and latency history
```

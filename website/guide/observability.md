# Observability

super-http fires hooks on every resilience event, letting you wire directly into your existing logger, metrics system, or tracing tool.

All handlers are **fire-and-forget** — errors thrown inside them are silently swallowed and never affect the request path.

---

## Registering hooks

```typescript
client.on({
  onRetry:              (event) => { /* ... */ },
  onCircuitStateChange: (event) => { /* ... */ },
  onBulkheadReject:     (event) => { /* ... */ },
  onFallback:           (event) => { /* ... */ },
  onRateLimitReject:    (event) => { /* ... */ },
})
```

Calling `.on()` multiple times **merges** the handlers (last write wins per key).

---

## Hook reference

### `onRetry`

Fired before each retry attempt.

```typescript
interface RetryEvent {
  attempt: number   // 0-based retry index
  error:   unknown  // the error that triggered the retry
  delayMs: number   // delay that will be waited before next attempt
}
```

```typescript
client.on({
  onRetry: ({ attempt, delayMs, error }) => {
    logger.warn(`Retry #${attempt} in ${delayMs}ms`, { error })
    metrics.increment('http.retry', { attempt })
  },
})
```

---

### `onCircuitStateChange`

Fired on every circuit breaker state transition.

```typescript
type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitStateChangeEvent {
  from:     CircuitState
  to:       CircuitState
  failures: number       // failure count at transition time
}
```

```typescript
client.on({
  onCircuitStateChange: ({ from, to, failures }) => {
    logger.warn(`Circuit: ${from} → ${to} (failures: ${failures})`)
    metrics.gauge('circuit.state', to === 'open' ? 1 : 0)

    if (to === 'open') {
      alerting.send(`Circuit opened after ${failures} failures`)
    }
  },
})
```

---

### `onBulkheadReject`

Fired when a request is rejected because the bulkhead is full.

```typescript
interface BulkheadRejectEvent {
  active: number  // in-flight requests at rejection time
  queued: number  // queued requests at rejection time
}
```

```typescript
client.on({
  onBulkheadReject: ({ active, queued }) => {
    metrics.increment('bulkhead.rejected')
    logger.warn(`Bulkhead full — active: ${active}, queued: ${queued}`)
  },
})
```

---

### `onFallback`

Fired when the fallback handler is invoked.

```typescript
interface FallbackEvent {
  error: unknown  // the original error that triggered the fallback
}
```

```typescript
client.on({
  onFallback: ({ error }) => {
    metrics.increment('fallback.triggered')
    logger.error('Fallback invoked', { error })
  },
})
```

---

### `onRateLimitReject`

Fired when a request is rejected by the rate limiter.

```typescript
interface RateLimitRejectEvent {
  permitLimit: number  // configured limit
  windowMs:    number  // window size in ms
}
```

```typescript
client.on({
  onRateLimitReject: ({ permitLimit, windowMs }) => {
    metrics.increment('rate_limit.rejected')
    logger.warn(`Rate limit hit — ${permitLimit} req / ${windowMs}ms`)
  },
})
```

---

## Full example with Prometheus-style metrics

```typescript
import { HttpClientFactory, ExponentialJitterRetryStrategy } from 'super-http'

const api = HttpClientFactory.create('https://api.example.com')

api
  .on({
    onRetry: ({ attempt, delayMs }) => {
      retryCounter.inc({ attempt })
      retryDelayHistogram.observe(delayMs / 1000)
    },
    onCircuitStateChange: ({ from, to, failures }) => {
      circuitStateGauge.set({ state: to }, 1)
      circuitStateGauge.set({ state: from }, 0)
      if (to === 'open') circuitOpenCounter.inc({ failures })
    },
    onBulkheadReject: () => bulkheadRejectedCounter.inc(),
    onFallback:       () => fallbackCounter.inc(),
    onRateLimitReject: () => rateLimitRejectedCounter.inc(),
  })
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
  .bulkhead({ maxConcurrent: 20, maxQueue: 100 })
  .rateLimit({ permitLimit: 200, windowMs: 60_000 })
```

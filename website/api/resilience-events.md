# ResilienceEvents

Observability hooks fired at every resilience event. All handlers are fire-and-forget — errors are swallowed and never affect the request path.

```typescript
import { ResilienceEvents } from 'super-http'
```

---

## Interface

```typescript
interface ResilienceEvents {
  onRequest?:            (config: AxiosRequestConfig)     => void
  onResponse?:           (response: AxiosResponse)        => void
  onError?:              (error: unknown)                 => void
  onRetry?:              (event: RetryEvent)              => void
  onCircuitStateChange?: (event: CircuitStateChangeEvent) => void
  onBulkheadReject?:     (event: BulkheadRejectEvent)     => void
  onFallback?:           (event: FallbackEvent)           => void
  onRateLimitReject?:    (event: RateLimitRejectEvent)    => void
}
```

Handlers **accumulate**: calling `on()` twice for the same hook registers both, and
all of them run. One throwing handler neither breaks the request nor stops the
others.

::: warning Changed in 2.0
Registration used to be last-wins per key, so two plugins observing `onRetry` meant
only the second one ever ran.
:::

---

## Event types

### RetryEvent

```typescript
interface RetryEvent {
  attempt:    number   // 0-based
  error:      unknown
  delayMs:    number
  requestId?: string   // present when client.correlate() is enabled
}
```

`BulkheadRejectEvent`, `FallbackEvent` and `RateLimitRejectEvent` carry
`requestId` too. Enable it with
[`client.correlate()`](../guide/observability#correlation-ids) — without it the
events are anonymous and a retry log line cannot be traced to its request.

### CircuitStateChangeEvent

```typescript
type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitStateChangeEvent {
  from:     CircuitState
  to:       CircuitState
  failures: number
}
```

### BulkheadRejectEvent

```typescript
interface BulkheadRejectEvent {
  active: number
  queued: number
}
```

### FallbackEvent

```typescript
interface FallbackEvent {
  error: unknown
}
```

### RateLimitRejectEvent

```typescript
interface RateLimitRejectEvent {
  permitLimit: number
  windowMs:    number
}
```

---

## Registration

```typescript
client.on({
  onRetry:              ({ attempt }) => console.log(`retry #${attempt}`),
  onCircuitStateChange: ({ from, to }) => console.log(`${from} → ${to}`),
})

// Calling .on() again merges (last write wins per key)
client.on({ onFallback: ({ error }) => console.error(error) })
```

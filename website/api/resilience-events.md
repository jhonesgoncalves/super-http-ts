# ResilienceEvents

Observability hooks fired at every resilience event. All handlers are fire-and-forget — errors are swallowed and never affect the request path.

```typescript
import { ResilienceEvents } from 'super-http'
```

---

## Interface

```typescript
interface ResilienceEvents {
  onRetry?:              (event: RetryEvent)              => void
  onCircuitStateChange?: (event: CircuitStateChangeEvent) => void
  onBulkheadReject?:     (event: BulkheadRejectEvent)     => void
  onFallback?:           (event: FallbackEvent)           => void
  onRateLimitReject?:    (event: RateLimitRejectEvent)    => void
}
```

---

## Event types

### RetryEvent

```typescript
interface RetryEvent {
  attempt: number   // 0-based
  error:   unknown
  delayMs: number
}
```

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

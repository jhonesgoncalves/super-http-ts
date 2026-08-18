# CircuitBreaker

Three-state circuit breaker: **closed → open → half-open**.

Usually managed automatically by `HttpClient.circuitBreak()`. You can also use it directly.

---

## Constructor

```typescript
const cb = new CircuitBreaker()
cb.setConfig({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
```

---

## `setConfig(config)`

```typescript
setConfig(config: CircuitBreakerConfig): void

interface CircuitBreakerConfig {
  failureThreshold: number   // consecutive counted failures; must be >= 1
  successThreshold: number   // successes to close from half-open; must be >= 1
  timeoutMs: number          // how long the circuit stays open
  shouldTrip?: (error: unknown) => boolean  // which errors count
}
```

Sets or updates the configuration. Intended to be called **once**, at wiring time:
a breaker carries state as well as thresholds, so reconfiguring one that is already
counting changes what the existing counters are compared against.

`failureThreshold` counts **consecutive** failures — any success resets the streak.

`shouldTrip` decides which errors move the counter. Via `HttpClient` it defaults to
network errors and 5xx only, so a burst of 404s or 401s from a healthy upstream will
not open the circuit. Errors the predicate rejects still propagate to the caller.

---

## `execute<T>(fn)`

```typescript
async execute<T>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>>
```

Wraps an async function with circuit-breaker protection.

**Throws** `Error('Circuit breaker is open')` when the circuit is open and the
timeout has not elapsed, **or** when the circuit is half-open and a probe is
already in flight — half-open admits exactly one probe at a time, so a recovering
upstream is not hit by the whole backlog.

---

## Properties

| Property | Type | Description |
|---|---|---|
| `state` | `CircuitState` | `'closed'` · `'open'` · `'half-open'` |
| `isOpen` | `boolean` | `true` when open |
| `isConfigured` | `boolean` | `true` once `setConfig` has run |

From an `HttpClient`, read the live state via
[`client.state()`](../guide/observability#current-state) rather than reaching for
the breaker instance.

```typescript
const cb = new CircuitBreaker()
cb.setConfig({ failureThreshold: 3, successThreshold: 1, timeoutMs: 5_000 })

const response = await cb.execute(() => axios.get('/api/data'))
```

---

## `handleIsOpen()`

```typescript
handleIsOpen(): boolean
```

Returns `false` when closed. Throws `Error('Circuit breaker is open')` when open and the timeout has not elapsed. Useful as a guard before starting work not wrapped via `execute()`.

---

## `isOpen`

```typescript
isOpen: boolean
```

Current open state of the circuit. Read-only in practice.

---

## CircuitBreakerConfig

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number
  successThreshold: number
  timeoutMs: number
}
```

| Option | Description |
|---|---|
| `failureThreshold` | Consecutive failures before the circuit opens |
| `successThreshold` | Consecutive successes (in half-open) to close the circuit |
| `timeoutMs` | Milliseconds the circuit stays open before probing |

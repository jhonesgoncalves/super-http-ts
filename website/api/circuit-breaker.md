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
```

Sets or updates the configuration.

---

## `execute<T>(fn)`

```typescript
async execute<T>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>>
```

Wraps an async function with circuit-breaker protection.

**Throws** `Error('Circuit breaker is open')` when the circuit is open and the timeout has not elapsed.

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

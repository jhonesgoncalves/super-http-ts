# Retry Strategies

All strategies implement the `RetryStrategy` interface:

```typescript
interface RetryStrategy {
  computeDelay(attempt: number, error?: unknown): number
}
```

Delays are validated at construction: a negative delay used to make `setTimeout`
fire immediately, producing a retry storm with no back-off at all.

Whether an error is retried at all is decided separately from the delay — see
[what gets retried](../guide/retry#what-gets-retried), which depends on the HTTP
method.

---

## FixedRetryStrategy

```typescript
new FixedRetryStrategy(delayMs: number)
```

Returns the same delay on every attempt.

```typescript
import { FixedRetryStrategy } from 'super-http'
client.retry(3, new FixedRetryStrategy(500))
// → 500ms, 500ms, 500ms
```

---

## ExponentialRetryStrategy

```typescript
new ExponentialRetryStrategy(
  initialDelayMs: number,
  maxDelayMs: number = 30_000,
  factor: number = 2
)
```

Delay = `min(initialDelayMs × factor^attempt, maxDelayMs)`

```typescript
import { ExponentialRetryStrategy } from 'super-http'
client.retry(4, new ExponentialRetryStrategy(100, 10_000))
// → 100ms, 200ms, 400ms, 800ms
```

---

## ExponentialJitterRetryStrategy ⭐

```typescript
new ExponentialJitterRetryStrategy(
  initialDelayMs: number,
  maxDelayMs: number = 30_000,
  factor: number = 2
)
```

Delay = `random(0, min(initialDelayMs × factor^attempt, maxDelayMs))`

Full-jitter prevents thundering-herd. **Recommended for distributed systems.**

```typescript
import { ExponentialJitterRetryStrategy } from 'super-http'
client.retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
// → random in [0–100ms], [0–200ms], [0–400ms], [0–800ms]
```

---

## RetryAfterStrategy

```typescript
new RetryAfterStrategy(
  initialDelayMs: number = 200,
  maxDelayMs: number = 60_000,
  factor: number = 2
)
```

Reads the `Retry-After` response header. Falls back to exponential jitter.

The parsed header is **capped at `maxDelayMs`** — the header is the server's
number, not your budget, so `Retry-After: 3600` must not park the caller for an
hour.

```typescript
import { RetryAfterStrategy } from 'super-http'
client.retry(5, new RetryAfterStrategy())
// Server: Retry-After: 30    → wait 30 000ms
// Server: Retry-After: 3600  → capped at maxDelayMs (60 s by default)
// Server: (no header)        → exponential jitter fallback
```

---

## Custom strategy

```typescript
import { RetryStrategy } from 'super-http'

class LinearRetryStrategy implements RetryStrategy {
  constructor(private readonly stepMs: number) {}
  computeDelay(attempt: number): number {
    return this.stepMs * (attempt + 1)
  }
}

client.retry(4, new LinearRetryStrategy(200))
// → 200ms, 400ms, 600ms, 800ms
```

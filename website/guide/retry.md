# Retry Strategies

## Basic usage

```typescript
import { ExponentialJitterRetryStrategy } from 'super-http'

client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
//           ^ max retries  ^ strategy
```

---

## Available strategies

### FixedRetryStrategy

Constant delay on every attempt.

```typescript
import { FixedRetryStrategy } from 'super-http'

client.retry(3, new FixedRetryStrategy(500))
// attempt 1 → wait 500ms → attempt 2 → wait 500ms → attempt 3
```

::: warning
Fixed delay can cause thundering-herd when many clients fail simultaneously. Prefer `ExponentialJitterRetryStrategy` for distributed systems.
:::

### ExponentialRetryStrategy

Delay doubles with each attempt (capped at `maxDelayMs`).

```typescript
import { ExponentialRetryStrategy } from 'super-http'

client.retry(4, new ExponentialRetryStrategy(100, 10_000))
// delays: 100ms → 200ms → 400ms → 800ms
```

### ExponentialJitterRetryStrategy ⭐ Recommended

Full-jitter exponential backoff ([AWS-recommended](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)).

Delay is a random value in `[0, min(maxDelayMs, initialDelayMs × factor^attempt)]`.

```typescript
import { ExponentialJitterRetryStrategy } from 'super-http'

client.retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
// delays: random in [0–100ms], [0–200ms], [0–400ms], [0–800ms]
// Different on every client → no thundering herd ✓
```

### RetryAfterStrategy

Honours the server's `Retry-After` response header (typically sent with 429 Too Many Requests or 503 Service Unavailable). Falls back to exponential jitter when the header is absent.

```typescript
import { RetryAfterStrategy } from 'super-http'

client.retry(5, new RetryAfterStrategy())

// Server responds: HTTP 429 + Retry-After: 30
// → client waits exactly 30 s before retrying ✓

// Server responds: HTTP 429 (no Retry-After header)
// → falls back to exponential jitter ✓
```

The `Retry-After` header can be:
- **Delta-seconds:** `"30"` → wait 30 s
- **HTTP-date:** `"Wed, 21 Oct 2025 07:28:00 GMT"` → wait until that time

### Legacy: plain number

For backwards compatibility, you can pass a number directly:

```typescript
client.retry(3, 500)  // FixedRetryStrategy(500) — same as v1.0.0
```

---

## What gets retried

By default, retries are triggered on **network errors** and **HTTP 5xx**:

| Condition | Retried | Why |
|---|:---:|---|
| `ECONNRESET` | ✅ | Transient socket issue |
| `ECONNREFUSED` | ✅ | Service not yet ready |
| `ETIMEDOUT` | ✅ | Network congestion |
| `EPIPE` / `ECONNABORTED` | ✅ | Broken connection |
| `ENOTFOUND` / `EAI_AGAIN` | ✅ | DNS failure |
| HTTP 5xx | ✅ | Server-side transient error |
| HTTP 4xx | ❌ | Client error — retrying won't help |

---

## Retry on specific status codes

```typescript
client.retry(5, new RetryAfterStrategy(), [429, 503])
// only retries 429 and 503; ignores other errors
```

---

## Circuit breaker awareness

When the circuit breaker is open, the retry wrapper immediately re-throws `"Circuit breaker is open"` — it does **not** wait for the delay or consume retry attempts.

```typescript
api
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
// If circuit opens mid-retry: thrown immediately, no delay wasted
```

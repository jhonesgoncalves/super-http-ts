# Retry

## Basic usage

```typescript
client.retry(3, 500)
// up to 3 retries, 500 ms between each attempt
```

---

## What gets retried

By default, super-http retries on **network errors** and **HTTP 5xx**:

| Condition | Retried | Reason |
|---|:---:|---|
| `ECONNRESET` (socket hang up) | ✅ | Transient — server closed idle connection |
| `ECONNREFUSED` | ✅ | Transient — port not listening yet |
| `ETIMEDOUT` | ✅ | Transient — network congestion |
| `EPIPE` | ✅ | Transient — broken pipe |
| `ENOTFOUND` / `EAI_AGAIN` | ✅ | DNS failure — may resolve |
| `ECONNABORTED` | ✅ | Connection aborted |
| HTTP `5xx` | ✅ | Server-side transient error |
| HTTP `4xx` | ❌ | Client error — retrying won't help |
| HTTP `2xx` / `3xx` | ❌ | Success or redirect |

---

## Retry on specific status codes

Use `retryOn` to override the default behaviour and retry only on exact HTTP status codes:

```typescript
// Retry only on 429 (rate limited) and 503 (service unavailable)
client.retry(5, 2_000, [429, 503])
```

::: warning
When `retryOn` is set, **network errors are not retried** unless their status code appears in the list. Use the default (no `retryOn`) if you want both.
:::

---

## Circuit breaker awareness

When the circuit is open, retry immediately rethrows `"Circuit breaker is open"` without waiting for the delay or consuming retry attempts. This prevents a stuck retry loop from blocking your event loop while the downstream is down.

```typescript
client
  .circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 5_000 })
  .retry(3, 500)

// If circuit opens mid-retry, the error is thrown immediately
// without burning the remaining retry attempts
```

---

## Delay strategy

The current delay is **fixed** — every retry waits exactly `delayMs` milliseconds. Exponential back-off is on the roadmap.

```typescript
client.retry(3, 500)
// attempt 1 fails → wait 500 ms
// attempt 2 fails → wait 500 ms
// attempt 3 fails → throw
```

---

## Examples

::: code-group

```typescript [Default — network + 5xx]
import { HttpClientFactory } from 'super-http'

const client = HttpClientFactory.create('https://api.example.com')
client.retry(3, 500)

const { data } = await client.get('/users')
```

```typescript [Rate-limit aware]
client.retry(5, 2_000, [429])
// back off 2 s on each 429, up to 5 times
```

```typescript [No retry]
// Just don't call .retry() — it's opt-in
const client = HttpClientFactory.create('https://api.example.com')
const { data } = await client.get('/users')
```

:::

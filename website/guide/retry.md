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

The parsed delay is capped at `maxDelayMs` (default 60 s). The header is the
server's number, not your budget — `Retry-After: 3600` must not park the caller
for an hour.

```typescript
client.retry(5, new RetryAfterStrategy(200, 30_000))
// Retry-After: 3600 → waits 30 s, not 1 hour
```

### Legacy: plain number

For backwards compatibility, you can pass a number directly:

```typescript
client.retry(3, 500)  // FixedRetryStrategy(500) — same as v1.0.0
```

---

## What gets retried

The rule is not "does this look transient" but **what does the error tell us about
whether the request already ran**.

| Condition | Retried | What it proves |
|---|:---:|---|
| `ECONNREFUSED` | ✅ any method | Connection never established — the request never ran |
| `ENOTFOUND` / `EAI_AGAIN` | ✅ any method | DNS never resolved — the request never ran |
| `ECONNRESET` / `EPIPE` | ⚠️ idempotent only | Connection died *after* the bytes went out |
| `ETIMEDOUT` / `ECONNABORTED` | ⚠️ idempotent only | No answer — it may have been applied |
| HTTP 5xx | ⚠️ idempotent only | The server received it and may have partially applied it |
| HTTP 4xx | ❌ | Client error — retrying won't help |

Idempotent methods are `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE` and `TRACE`
(RFC 9110 §9.2.2).

::: danger Why POST is not retried by default
Axios reports its own timeout as `ETIMEDOUT` or `ECONNABORTED`. A `POST` that
times out may already have been fully processed upstream — the answer just never
came back. Retrying it charges the card twice.

Before 2.0 this happened by default. See the
[migration guide](./migration-2#retry-now-respects-idempotency).
:::

### Retrying a POST anyway

Only do this where the endpoint is protected by an idempotency key:

```typescript
// Per client
client.retry(3, 500, { retryNonIdempotent: true })

// Per request — preferable, since the scope is visible at the call site
await client.request({
  url: '/charges',
  method: 'post',
  data: payload,
  headers: { 'Idempotency-Key': chargeId },
  policy: { retry: { attempts: 3, retryNonIdempotent: true } },
})
```

---

## Retry on specific status codes

`retryOn` **adds** status codes on top of the network-error rules:

```typescript
client.retry(5, new RetryAfterStrategy(), [429, 503])
// retries 429 and 503 AND network errors
```

::: warning Changed in 2.0
In 1.x `retryOn` *replaced* the network-error check, so adding a status code
silently switched off `ECONNRESET` retries. It is additive now.
:::

---

## Per-request overrides

```typescript
await client.request({
  url: '/recommendations',
  policy: { retry: { attempts: 5 } },       // inherits the client's strategy
})

await client.request({
  url: '/recommendations',
  policy: { retry: { attempts: 5, delayMs: 200 } },  // explicit fixed delay
})
```

Passing `delayMs` means a fixed delay. Omitting it inherits whatever strategy the
client was configured with — in 1.x the override always forced a fixed 100 ms,
silently discarding a configured jitter strategy.

---

## Retry and the total deadline

Retry attempts and their backoff sleeps come out of the call's
[deadline](./deadlines) when one is set. If the next backoff would not fit in the
remaining budget, the call fails immediately with the underlying error instead of
sleeping and then failing anyway.

```typescript
client.retry(5, 1_000).deadline(2_500)
// ~2 retries fit; the third is not attempted
```

The backoff is also abortable — `policy: { signal }` stops a retry loop mid-sleep.

---

## Circuit breaker awareness

When the circuit breaker is open, the retry wrapper immediately re-throws `"Circuit breaker is open"` — it does **not** wait for the delay or consume retry attempts.

```typescript
api
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
// If circuit opens mid-retry: thrown immediately, no delay wasted
```

## Bulkhead and rate limiter awareness

Retry sits **outside** the bulkhead and the rate limiter:

```
retry
 └─► bulkhead        (slot released during backoff)
      └─► rate limiter  (a token per attempt)
           └─► circuit breaker
                └─► HTTP request
```

Two consequences worth knowing:

- **Each attempt takes its own rate-limiter token.** `permitLimit` bounds what
  actually leaves your process, retries included. In 1.x only the first attempt
  took a token, so `permitLimit: 100` with `retry(3)` could emit 400 requests.
- **A backoff sleep does not hold a bulkhead slot.** Other callers are served
  while a failing request waits. In 1.x the slot was held for the whole sequence,
  so concurrency collapsed with no socket in use.

A request rejected by the bulkhead or the rate limiter is **not** retried —
re-queueing shed load is the load they exist to refuse.

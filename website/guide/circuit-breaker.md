# Circuit Breaker

## Concept

The circuit breaker is a stability pattern that **stops sending requests to a failing service** and gives it time to recover. Instead of waiting for each request to time out, requests fail immediately with a clear error.

---

## State machine

```
        failures >= failureThreshold
CLOSED ────────────────────────────► OPEN
  ▲                                    │
  │  successes >= successThreshold  timeoutMs elapsed
  │                                    ▼
  └──────────────────────────────  HALF-OPEN
               probe succeeds
```

### Closed (normal)
Requests flow normally. Each counted failure increments the counter, and **any
success resets it to zero** — `failureThreshold` means *consecutive* failures.
When the streak reaches the threshold, the circuit **trips** to open.

### Open (tripped)
All requests throw immediately:
```
Error: Circuit breaker is open
```
No network call is made. After `timeoutMs` milliseconds, the circuit moves to half-open.

### Half-open (probing)
Exactly **one** request at a time is allowed through as a probe. Concurrent
callers arriving while a probe is in flight get `Circuit breaker is open` — a
recovering upstream should not be hit by the whole backlog at once.

- **Succeeds** → success counter increments. After `successThreshold` successes, the circuit **closes**.
- **Fails** → circuit re-opens immediately and the timeout resets.

---

## What counts as a failure

By default only **network errors and 5xx responses** count. A `4xx` is a correct
answer from a healthy service about a bad request, so it does not move the
counter:

| Response | Counts | Why |
|---|:---:|---|
| Network error, timeout, reset | ✅ | The integration point failed |
| HTTP 5xx | ✅ | The upstream is faulting |
| HTTP 4xx | ❌ | The caller asked for something wrong |
| HTTP 429 | ❌ | Backpressure — the rate limiter and `Retry-After` handle it |

::: warning Changed in 2.0
In 1.x every rejected request counted, and axios rejects `4xx`. A crawler hitting
missing pages or a batch of expired tokens would open the circuit on an upstream
that was answering perfectly — and then take down the traffic that was working.
:::

Supply your own predicate to change this:

```typescript
client.circuitBreak({
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 10_000,
  // Count 429 as a failure too, e.g. when the upstream has no rate-limit contract
  shouldTrip: (error) => {
    const status = (error as { response?: { status?: number } })?.response?.status
    return status === undefined || status >= 500 || status === 429
  },
})
```

Errors the predicate rejects still propagate to the caller unchanged — they
simply do not move the failure counter.

---

## Configuration

```typescript
client.circuitBreak({
  failureThreshold: 5,   // trip after 5 consecutive failures
  successThreshold: 2,   // require 2 consecutive successes to close
  timeoutMs: 10_000,     // stay open for 10 s before probing
})
```

### Tuning guide

| Use case | `failureThreshold` | `successThreshold` | `timeoutMs` |
|---|---|---|---|
| Critical dependency | 10 | 3 | 30 000 |
| Non-critical service | 3 | 1 | 5 000 |
| High-traffic endpoint | 20 | 5 | 60 000 |
| Development / testing | 2 | 1 | 1 000 |

---

## Handling the open state

Catch `"Circuit breaker is open"` to fall back gracefully:

```typescript
import { HttpClientFactory } from 'super-http'

const recommendations = HttpClientFactory.create('https://recs.internal')
  .circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 5_000 })

async function getRecommendations(userId: string) {
  try {
    const { data } = await recommendations.get(`/users/${userId}`)
    return data
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Circuit breaker is open') {
      // Degrade gracefully — return cached or empty results
      return []
    }
    throw err
  }
}
```

---

## Reading the current state

`metrics().circuitBreakerTrips` counts how many times the circuit has *ever*
opened. To answer "is it open right now?" — the question a dashboard or an alert
actually asks — use `state()`:

```typescript
const s = client.state()
if (s.circuit?.open) {
  // skip the call, serve from cache
}

// Breakers created for per-request policy overrides are listed separately
s.policyCircuits // { '1:1:60000': { state: 'open', open: true } }
```

---

## Combining with retry

The circuit breaker is the innermost policy, so every retry attempt goes through
it:

```typescript
client
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500)
```

Execution order per request:

```
retry
 └─► bulkhead
      └─► rate limiter
           └─► circuit breaker
                └─► actual HTTP request
```

If the circuit is open, the retry wrapper receives `"Circuit breaker is open"` and **stops immediately** — it does not wait for the delay or burn retry attempts.

---

## Per-request overrides get their own breaker

A `policy.circuitBreaker` override is a *different* breaker, with its own
thresholds and its own failure counter:

```typescript
// This breaker is dedicated to threshold 1 — it does not touch the client's
await client.request({
  url: '/optional-enrichment',
  policy: { circuitBreaker: { failureThreshold: 1, timeoutMs: 30_000 } },
})
```

Up to 64 distinct configurations are tracked per client; beyond that, overrides
fall back to the client-level breaker. Since policies are normally constant
literals, that ceiling only exists to stop a caller that builds configs
dynamically from growing the map without bound.

---

## Example

```typescript
import { HttpClientFactory } from 'super-http'

const api = HttpClientFactory.create('https://api.example.com')

api
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(3, 300)

// Normal flow
const { data } = await api.get('/products')

// Simulating upstream failure
// After 5 failures:
//   → circuit opens
//   → all requests throw immediately for 15 s
//   → one probe goes through
//   → after 2 successes, circuit closes
```

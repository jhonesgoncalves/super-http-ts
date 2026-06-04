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
Requests flow normally. Each failure increments the counter. When `failureThreshold` consecutive failures occur, the circuit **trips** to open.

### Open (tripped)
All requests throw immediately:
```
Error: Circuit breaker is open
```
No network call is made. After `timeoutMs` milliseconds, the circuit moves to half-open.

### Half-open (probing)
One request is allowed through as a probe:
- **Succeeds** → success counter increments. After `successThreshold` consecutive successes, the circuit **closes**.
- **Fails** → circuit re-opens and the timeout resets.

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

## Combining with retry

When both are configured, the circuit breaker wraps the retry:

```typescript
client
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500)
```

Execution order per request:

```
retry wrapper
  └─► circuit breaker
        └─► actual HTTP request
```

If the circuit is open, the retry wrapper receives `"Circuit breaker is open"` and **stops immediately** — it does not wait for the delay or burn retry attempts.

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

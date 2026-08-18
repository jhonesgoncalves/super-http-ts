# RateLimiter

Fixed-window token-bucket rate limiter.

```typescript
import { RateLimiter, RateLimitConfig } from 'super-http'
```

---

## RateLimitConfig

```typescript
interface RateLimitConfig {
  permitLimit: number       // must be >= 1
  windowMs: number          // must be >= 1
  queueRequests?: boolean   // default: false
  queueTimeoutMs?: number   // default: 10_000 — pass Infinity to wait forever
  maxQueue?: number         // default: 1_000
}
```

`permitLimit` and `windowMs` are validated. `permitLimit: 0` used to reject (or
hang) every request forever, and `windowMs: 0` refilled on every acquire — silently
turning the limiter into a no-op that permitted unlimited traffic.

---

## Usage via HttpClient

```typescript
client.rateLimit({ permitLimit: 100, windowMs: 60_000 })
```

---

## Direct usage

```typescript
const rl = new RateLimiter({ permitLimit: 100, windowMs: 60_000 })

await rl.acquire()  // blocks or throws if limit exceeded
// then make your request
```

`acquire` accepts options so a queued caller can be cancelled or bounded:

```typescript
await rl.acquire({ signal: controller.signal, maxWaitMs: 500 })
```

Via `HttpClient`, **every attempt takes a token, retries included** — the limit
bounds what actually leaves your process.

---

## Properties

| Property | Type | Description |
|---|---|---|
| `available` | `number` | Tokens remaining in current window |
| `queuedCount` | `number` | Requests currently waiting for a token |

---

## Errors

| Error message | When |
|---|---|
| `'Rate limit exceeded'` | Limit hit and `queueRequests` is `false` |
| `'Rate limit queue full'` | `queueRequests` is `true` and the queue is at `maxQueue` |
| `'Rate limit queue timeout'` | Queued request waited > the effective timeout |

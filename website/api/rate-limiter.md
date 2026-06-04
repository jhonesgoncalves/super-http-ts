# RateLimiter

Fixed-window token-bucket rate limiter.

```typescript
import { RateLimiter, RateLimitConfig } from 'super-http'
```

---

## RateLimitConfig

```typescript
interface RateLimitConfig {
  permitLimit: number
  windowMs: number
  queueRequests?: boolean   // default: false
  queueTimeoutMs?: number   // default: undefined
}
```

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

---

## Properties

| Property | Type | Description |
|---|---|---|
| `available` | `number` | Tokens remaining in current window |

---

## Errors

| Error message | When |
|---|---|
| `'Rate limit exceeded'` | Limit hit and `queueRequests` is `false` |
| `'Rate limit queue timeout'` | Queued request waited > `queueTimeoutMs` |

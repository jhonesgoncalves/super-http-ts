# Rate Limiter

The rate limiter controls the number of outgoing requests per time window, preventing you from accidentally overwhelming upstream services or triggering their rate-limit responses.

---

## Basic usage

```typescript
// Max 100 requests per minute — reject excess immediately
client.rateLimit({ permitLimit: 100, windowMs: 60_000 })
```

---

## With queuing

```typescript
// Queue excess requests; wait up to 5 s for a token
client.rateLimit({
  permitLimit: 100,
  windowMs: 60_000,
  queueRequests: true,
  queueTimeoutMs: 5_000,
})
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `permitLimit` | `number` | — | Max requests per window |
| `windowMs` | `number` | — | Window length in ms |
| `queueRequests` | `boolean` | `false` | Queue excess instead of rejecting |
| `queueTimeoutMs` | `number` | `undefined` | Max wait time for a queued token |

---

## Error types

| Error | When |
|---|---|
| `Error('Rate limit exceeded')` | Limit hit and `queueRequests` is `false` |
| `Error('Rate limit queue timeout')` | Queued request waited > `queueTimeoutMs` |

---

## With RetryAfterStrategy

Pair the rate limiter with `RetryAfterStrategy` to back off exactly as long as the server requests:

```typescript
import { RetryAfterStrategy } from 'super-http'

client
  .rateLimit({ permitLimit: 100, windowMs: 60_000 })
  .retry(5, new RetryAfterStrategy())
// Server says "Retry-After: 30" → client waits 30 s exactly
```

---

## Observability

```typescript
client
  .on({
    onRateLimitReject: ({ permitLimit, windowMs }) =>
      metrics.increment('rate_limit.rejected', { permitLimit, windowMs }),
  })
  .rateLimit({ permitLimit: 200, windowMs: 60_000 })
```

---

## Sizing

| Upstream SLA | Recommended `permitLimit` |
|---|---|
| 60 req/min | 55 (leave 8% headroom) |
| 1000 req/min | 900 |
| Unknown | Start at 50 and tune up |

::: tip
Always leave a small headroom below the upstream limit to account for clock drift and bursts from other clients sharing the same API key.
:::

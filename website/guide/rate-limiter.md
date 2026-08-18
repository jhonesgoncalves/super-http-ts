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
| `permitLimit` | `number` | — | Max requests per window. Must be ≥ 1 |
| `windowMs` | `number` | — | Window length in ms. Must be ≥ 1 |
| `queueRequests` | `boolean` | `false` | Queue excess instead of rejecting |
| `queueTimeoutMs` | `number` | `10000` | Max wait for a queued token. Pass `Infinity` to wait indefinitely |
| `maxQueue` | `number` | `1000` | Max requests allowed to wait for a token |

::: warning Changed in 2.0
`queueTimeoutMs` used to default to **waiting forever**, and the wait queue had
no size limit at all — a saturated window grew it without bound, which is a memory
leak plus latency nobody can put a number on. Both now have defaults.
:::

::: danger permitLimit and windowMs must be at least 1
`permitLimit: 0` used to reject (or hang) every request forever, and `windowMs: 0`
refilled on every acquire — silently turning the limiter into a no-op that
permitted unlimited traffic. Both now throw at the call that sets them.
:::

---

## What counts against the limit

Every attempt that leaves the process takes a token, **retries included**:

```typescript
client.retry(3, 500).rateLimit({ permitLimit: 100, windowMs: 60_000 })
// At most 100 requests/min reach the upstream, not 400
```

::: warning Changed in 2.0
In 1.x only the first attempt of a call took a token, so this configuration could
emit 400 requests per minute. The limiter now bounds what actually goes out.
:::

A request rejected by the limiter is not retried.

---

## Error types

| Error | When |
|---|---|
| `Error('Rate limit exceeded')` | Limit hit and `queueRequests` is `false` |
| `Error('Rate limit queue full')` | `queueRequests` is `true` and the queue is at `maxQueue` |
| `Error('Rate limit queue timeout')` | Queued request waited > `queueTimeoutMs`, or ran out of [deadline](./deadlines) budget |

A queued request also gives up when its `AbortSignal` fires, and is removed from
the queue when it does. `client.state().rateLimit` reports live `available` tokens
and `queued` depth.

---

## Window shape

This is a **fixed-window** limiter: tokens refill to `permitLimit` at the start of
each window. That permits up to `2 × permitLimit` across a window boundary, so
leave headroom below the upstream's limit (see
[production readiness](./production-readiness#rate-limiter)).

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

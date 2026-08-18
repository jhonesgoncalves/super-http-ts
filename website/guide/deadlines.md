# Deadlines & Cancellation

`timeout` bounds **one attempt**. A deadline bounds **the whole call**.

## The problem

With retries and queueing configured, `timeout` tells you almost nothing about how
long `await client.get()` can take. Using the shipped `resilient-api` preset:

| Stage | Worst case |
|---|---|
| Bulkhead queue wait | 5 s |
| 4 attempts × 15 s timeout | 60 s |
| 3 exponential-jitter backoffs | ~11 s |
| **Total** | **~76 s** |

Nothing subtracted the time already spent, so each attempt got a fresh full
timeout. A slow response costs the caller more than a fast failure — it holds
their resources while they wait.

## Setting a deadline

```typescript
client.deadline(2_000)                      // whole client
```

```typescript
await client.request({                      // one call
  url: '/recommendations',
  policy: { deadlineMs: 500 },
})
```

Queue waits, every attempt and every backoff come out of the same budget. Each
stage clamps itself to what is left:

- The **rate-limiter** and **bulkhead** waits are capped at the remaining budget,
  even when `queueTimeoutMs` is larger.
- Each **attempt's timeout** becomes `min(timeout, remaining)`.
- Retry **fails immediately** rather than sleeping past the deadline — if the next
  backoff does not fit, you get the underlying error now instead of the same error
  later.

```typescript
client.retry(5, 1_000).deadline(2_500)
// ~2 retries fit in the budget; the third is never attempted
```

A deadline is bounded on the way in: `deadline(0)` and negative values throw.

## Cancellation

`policy.signal` cancels the whole call — not just the socket:

```typescript
const controller = new AbortController()

const pending = client.request({
  url: '/report',
  policy: { signal: controller.signal },
})

controller.abort()
```

Aborting stops the in-flight request, a retry backoff mid-sleep, a bulkhead queue
wait and a rate-limiter queue wait. Nothing keeps working after the caller has
given up, and no further attempt reaches the upstream.

::: warning New in 2.0
In 1.x an `AbortSignal` reached axios but no resilience layer observed it: the
caller gave up while the retry loop slept through its backoff and then issued the
next attempt anyway.
:::

A signal can be reused across many requests — listeners are attached per call and
detached when it settles.

## Recognising the errors

```typescript
import { isCancellation, DeadlineExceededError } from 'super-http'

try {
  await client.get('/slow')
} catch (err) {
  if (err instanceof DeadlineExceededError) {
    // budget exhausted — the upstream was too slow
  }
  if (isCancellation(err)) {
    // deadline or caller abort; never worth retrying
  }
}
```

`isCancellation` also recognises axios's own `ERR_CANCELED` and the DOM
`AbortError`, so it is safe to use as a blanket "should I give up" check.

Neither a deadline nor an abort is ever retried. A deadline **does** count toward
the circuit breaker — a consistently too-slow upstream is a failing one — while a
caller abort does not reach the breaker at all.

## Combining the two

Use both when the caller has its own budget and its own cancellation:

```typescript
// An HTTP handler with a 3 s SLO, cancelled if the client disconnects
app.get('/dashboard', async (req, res) => {
  const controller = new AbortController()
  req.on('close', () => controller.abort())

  const { data } = await api.request({
    url: '/widgets',
    policy: { deadlineMs: 3_000, signal: controller.signal },
  })
  res.json(data)
})
```

## Choosing a value

Work backwards from your own SLO, not from the upstream's behaviour:

| Caller | Suggested deadline |
|---|---|
| User-facing request path | Your p99 SLO minus what the rest of the handler needs |
| Server-to-server, latency-sensitive | 1–3 s |
| Background job | Generous, but never unbounded |
| Optional enrichment | Short, with a `fallback` |

A deadline shorter than a single attempt's `timeout` is fine and often correct —
the attempt is simply cut to the budget.

```typescript
// The recommendation widget is nice to have; the page must not wait for it
client
  .deadline(300)
  .fallback(() => ({ data: [] }))
```

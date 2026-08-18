# Migrating from 1.x to 2.0

2.0 changes a number of defaults. Every one of them was unsafe: the old default
could re-send a payment, hand one caller another caller's response, open a
circuit on a healthy service, or block a caller indefinitely.

**If you upgrade and change nothing, most applications behave the same but
safer.** The cases that need a decision from you are listed first.

## Do I need to change anything?

Work through these five questions. If you answer "no" to all of them, upgrading
is a version bump.

1. Do you retry `POST` or `PATCH` requests and rely on that? → [Retry](#retry-now-respects-idempotency)
2. Do you pass `retryOn` to `retry()`? → [retryOn](#retryon-is-additive)
3. Do you rely on `.dedup()` for methods other than `GET`/`HEAD`, or on gRPC
   unary dedup? → [Deduplication](#deduplication-is-narrower-and-safer)
4. Do you configure a `Bulkhead` or `RateLimiter` without `queueTimeoutMs` and
   want callers to wait indefinitely? → [Queues](#queues-no-longer-wait-forever)
5. Do you count on a `4xx` response opening the circuit breaker? → [Circuit breaker](#4xx-no-longer-trips-the-circuit)

---

## Retry now respects idempotency

**What changed.** Errors that prove the request never ran are still retried for
any method. Ambiguous errors — where the request may already have been applied
upstream — are now retried only for idempotent methods.

| Error | Retried in 1.x | Retried in 2.0 |
|---|---|---|
| `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN` | any method | any method |
| `ECONNRESET`, `ETIMEDOUT`, `ECONNABORTED`, `EPIPE` | any method | `GET`/`HEAD`/`OPTIONS`/`PUT`/`DELETE`/`TRACE` only |
| any `5xx` | any method | idempotent methods only |

**Why.** Axios reports its own timeout as `ETIMEDOUT` or `ECONNABORTED`, both of
which 1.x retried unconditionally. So **every timed-out `POST` was re-sent**. A
`POST /payments` with `retry(3)` against a slow gateway could charge four times,
and nothing in the library prevented it.

**To keep the old behaviour**, opt in explicitly — ideally only where the
endpoint is protected by an idempotency key:

```typescript
// Per client
client.retry(3, 500, { retryNonIdempotent: true })

// Per request
await client.request({
  url: '/orders',
  method: 'post',
  data: order,
  headers: { 'Idempotency-Key': order.id },
  policy: { retry: { attempts: 3, retryNonIdempotent: true } },
})
```

## `retryOn` is additive

**What changed.** `retryOn` now *adds* status codes to the network-error rules
instead of replacing them.

```typescript
client.retry(3, 500, [503])
// 1.x: retries ONLY on 503 — ECONNRESET was silently no longer retried
// 2.0: retries on 503 AND on network errors
```

**Why.** The replacement behaviour was a trap: adding a status code quietly
turned off connection-error retries, which is the opposite of what the call
reads like.

**To keep the old behaviour**, filter in your own code — or reconsider, since
this was almost certainly not what you wanted.

## `4xx` no longer trips the circuit

**What changed.** The circuit breaker counts network errors and `5xx` responses.
It no longer counts `4xx`, including `429`.

**Why.** Axios rejects `4xx` responses, and the breaker counted every rejection.
A crawler hitting missing pages, a client looping on an invalid id, or a batch of
expired tokens would open the circuit on an upstream that was answering
correctly — and then take down the traffic that was working. `429` is
backpressure, which the rate limiter and `Retry-After` handle; opening a circuit
is the wrong response to it.

**To customise**, supply your own predicate:

```typescript
client.circuitBreak({
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 10_000,
  // Count everything, as 1.x did
  shouldTrip: () => true,
})
```

## Deduplication is narrower and safer

**Two changes.**

1. The request **body is now part of the key**. In 1.x the key was
   `method:url:params`, so two concurrent `POST`s with different payloads
   collapsed into one call and the second caller received the first one's
   response. (The 1.x documentation claimed the body was already keyed. It was
   not.)
2. Only `GET` and `HEAD` are coalesced by default.

```typescript
client.dedup()                                       // GET + HEAD
client.dedup({ methods: ['GET', 'HEAD', 'POST'] })   // opt in deliberately
```

A body that cannot be compared byte-for-byte — a stream, a `FormData`, a
circular object — is never deduplicated. Skipping the optimisation costs one
extra request; getting it wrong returns the wrong data.

**gRPC dedup is now opt-in.** In 1.x every unary call was deduplicated with no
way to disable it, so two concurrent identical mutations became one RPC:

```typescript
createGrpcClient({ address, definition, dedup: true }) // restore 1.x behaviour
```

## Queues no longer wait forever

**What changed.** `queueTimeoutMs` defaults to 10 s on both `Bulkhead` and
`RateLimiter`. The rate limiter also gained `maxQueue` (default 1000).

**Why.** In 1.x omitting `queueTimeoutMs` meant waiting indefinitely, and
`maxQueue` defaulted to 50 — so `bulkhead({ maxConcurrent: 10 })` gave you 50
queue slots that could block forever. The shipped gRPC `resilient-api` preset had
exactly this shape, with a 200-deep queue and no timeout.

**To keep an unbounded wait**, ask for it explicitly:

```typescript
client.bulkhead({ maxConcurrent: 10, queueTimeoutMs: Infinity })
```

## Configuration errors now throw

Values that used to be accepted and then misbehave at runtime now throw at the
call that sets them:

| Config | 1.x behaviour | 2.0 |
|---|---|---|
| `bulkhead({ maxConcurrent: 0 })` | every request queued forever, no error | `RangeError` |
| `rateLimit({ permitLimit: 0 })` | rejected or hung forever | `RangeError` |
| `rateLimit({ windowMs: 0 })` | limiter became a silent no-op | `RangeError` |
| `circuitBreak({ failureThreshold: 0 })` | circuit permanently open | `RangeError` |
| `new FixedRetryStrategy(-1000)` | retry storm with no back-off | `RangeError` |
| `{ maxSockets: 0 }` | *unlimited* sockets (Node's reading) | `RangeError` |
| gRPC `preset: 'typo'` | silently ignored — no resilience at all | `RangeError` |

If your configuration is valid, nothing changes. If it throws, it was broken
before too — just silently.

## Body size limits

Responses and request bodies are capped at 32 MiB, where axios defaults to
unlimited. Raise it if you legitimately transfer more:

```typescript
HttpClientFactory.create(baseURL, {}, { maxContentLength: 128 * 1024 * 1024 })
```

## `on()` accumulates handlers

In 1.x each `on()` call overwrote the previous handler for the same key, so two
plugins observing `onRetry` meant only the second one ran. Handlers now
accumulate and all of them are invoked; one throwing handler does not stop the
others.

If you relied on re-registering to *replace* a handler, that no longer works —
register once, or branch inside the handler.

---

# New in 2.0

None of this is required, but it is what the release is for.

## Total deadlines

`timeout` bounds one attempt. In 1.x nothing bounded a call: with the
`resilient-api` preset, one `await client.get()` could take ~76 s (5 s bulkhead
queue + 4 × 15 s attempts + ~11 s of backoff).

```typescript
client.deadline(2_000)                                    // whole client
await client.request({ url: '/x', policy: { deadlineMs: 500 } })  // one call
```

Queue waits, every attempt and every backoff come out of the same budget, and
each stage clamps itself to what is left. Retry fails immediately rather than
sleeping past the deadline.

## Cancellation

```typescript
const controller = new AbortController()
const pending = client.request({ url: '/report', policy: { signal: controller.signal } })
controller.abort()   // stops the in-flight request, the backoff and any queue wait
```

## Current state

```typescript
const s = client.state()
s.circuit?.open        // is it open RIGHT NOW — metrics() only counts past trips
s.bulkhead?.queued
s.rateLimit?.available
```

## Correlation ids

```typescript
client.correlate()   // x-request-id header + requestId on every event

client.on({
  onRetry: ({ requestId, attempt }) => log.warn({ requestId, attempt }, 'retrying'),
})
```

## Releasing resources

```typescript
await client.close()      // destroys both agents' sockets, clears plugin timers
HttpClientFactory.clear() // now closes each client before dropping it
```

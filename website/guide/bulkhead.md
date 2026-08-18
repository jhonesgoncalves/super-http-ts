# Bulkhead

The bulkhead pattern (inspired by Polly's `BulkheadPolicy` and Resilience4j's `Bulkhead`) limits the number of concurrent calls to a service, preventing one slow dependency from monopolising all resources.

---

## The problem

Without isolation, a single slow or failing dependency can consume all concurrency and block unrelated services:

```
Without bulkhead:
  slow-api: 50 concurrent calls (all waiting 30s)
  fast-api: 0 slots left ← blocked by slow-api

With bulkhead (maxConcurrent: 5):
  slow-api: max 5 calls at a time
  fast-api: completely unaffected ✓
```

---

## Basic usage

```typescript
client.bulkhead({ maxConcurrent: 20 })
```

Requests beyond `maxConcurrent` **queue** — `maxQueue` defaults to 50 — and wait
up to `queueTimeoutMs` (default 10 s) for a slot. Set `maxQueue: 0` to reject
immediately instead.

---

## With queue

```typescript
client.bulkhead({
  maxConcurrent: 20,    // max in-flight at any moment
  maxQueue: 100,        // queue up to 100 excess requests
  queueTimeoutMs: 3_000 // reject queued requests after 3 s
})
```

When a slot frees up, the oldest queued request is promoted.

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxConcurrent` | `number` | — | Max in-flight requests. Must be ≥ 1 |
| `maxQueue` | `number` | `50` | Max requests in the waiting queue |
| `queueTimeoutMs` | `number` | `10000` | Reject queued request after this many ms. Pass `Infinity` to wait indefinitely |

::: warning Changed in 2.0
`queueTimeoutMs` used to default to `undefined`, which meant **waiting forever**.
So `bulkhead({ maxConcurrent: 20 })` gave you 50 queue slots that could block a
caller indefinitely — a blocked thread by another name, and the most common way a
healthy service is taken down by a sick dependency. An unbounded wait is now
opt-in via `Infinity`.
:::

::: danger maxConcurrent must be at least 1
`maxConcurrent: 0` used to be accepted and then deadlock every request with no
error at all. It now throws at the call that sets it.
:::

---

## Error types

| Error | When |
|---|---|
| `Error('Bulkhead queue full')` | `active >= maxConcurrent` AND `queue.length >= maxQueue` |
| `Error('Bulkhead queue timeout')` | Queued request waited longer than `queueTimeoutMs`, or ran out of [deadline](./deadlines) budget |

Neither is retried: re-queueing a shed request is exactly the load the bulkhead
exists to refuse.

---

## Deadlines and cancellation

A queued request also gives up when the call's [deadline](./deadlines) runs out or
its `AbortSignal` fires, and is removed from the queue when it does:

```typescript
const controller = new AbortController()
client.bulkhead({ maxConcurrent: 5, queueTimeoutMs: 30_000 })

const pending = client.request({ url: '/report', policy: { signal: controller.signal } })
controller.abort()  // leaves the queue immediately, does not hold a slot
```

`client.state().bulkhead` reports live `active` and `queued` counts.

---

## Observability

```typescript
client
  .on({ onBulkheadReject: ({ active, queued }) =>
    metrics.increment('bulkhead.rejected', { active, queued })
  })
  .bulkhead({ maxConcurrent: 20, maxQueue: 100 })
```

---

## Sizing guide

| Service type | `maxConcurrent` | `maxQueue` |
|---|---|---|
| Critical, fast API | 50–100 | 200 |
| Non-critical, slow API | 5–10 | 20 |
| Background jobs | 2–5 | 10 |
| High-throughput microservice | 100–200 | 500 |

::: tip
Start conservative and tune up. It's better to queue than to let one service take down others.
:::

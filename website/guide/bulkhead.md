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

Requests beyond `maxConcurrent` are **rejected immediately** by default.

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
| `maxConcurrent` | `number` | — | Max in-flight requests |
| `maxQueue` | `number` | `50` | Max requests in the waiting queue |
| `queueTimeoutMs` | `number` | `undefined` | Reject queued request after this many ms |

---

## Error types

| Error | When |
|---|---|
| `Error('Bulkhead queue full')` | `active >= maxConcurrent` AND `queue.length >= maxQueue` |
| `Error('Bulkhead queue timeout')` | Queued request waited longer than `queueTimeoutMs` |

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

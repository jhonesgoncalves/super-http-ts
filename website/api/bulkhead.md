# Bulkhead

Concurrency limiter with optional bounded queue.

```typescript
import { Bulkhead, BulkheadConfig } from 'super-http'
```

---

## BulkheadConfig

```typescript
interface BulkheadConfig {
  maxConcurrent: number    // must be >= 1
  maxQueue?: number         // default: 50
  queueTimeoutMs?: number   // default: 10_000 — pass Infinity to wait forever
}
```

`maxConcurrent` is validated: `0` used to be accepted and then deadlock every
request with no error, so it now throws at the call that sets it.

---

## Usage via HttpClient

```typescript
client.bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
```

---

## Direct usage

```typescript
const bh = new Bulkhead({ maxConcurrent: 5, maxQueue: 20 })

const result = await bh.execute(() => fetch('/api/data'))
```

`execute` accepts a second argument so a queued caller can be cancelled or bounded
by a caller's remaining budget:

```typescript
await bh.execute(fn, { signal: controller.signal, maxWaitMs: 500 })
```

The effective wait is the smaller of `queueTimeoutMs` and `maxWaitMs`. A queued
entry that aborts or times out is removed from the queue.

---

## Properties

| Property | Type | Description |
|---|---|---|
| `activeCount` | `number` | Current in-flight requests |
| `queuedCount` | `number` | Current queued requests |

---

## Errors

| Error message | When |
|---|---|
| `'Bulkhead queue full'` | `active >= maxConcurrent` AND `queue >= maxQueue` |
| `'Bulkhead queue timeout'` | Queued request waited > the effective timeout |

Neither error is retried — re-queueing a shed request is the load the bulkhead
exists to refuse.

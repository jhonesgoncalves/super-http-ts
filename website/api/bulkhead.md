# Bulkhead

Concurrency limiter with optional bounded queue.

```typescript
import { Bulkhead, BulkheadConfig } from 'super-http'
```

---

## BulkheadConfig

```typescript
interface BulkheadConfig {
  maxConcurrent: number
  maxQueue?: number        // default: 50
  queueTimeoutMs?: number  // default: undefined (wait forever)
}
```

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
| `'Bulkhead queue timeout'` | Queued request waited > `queueTimeoutMs` |

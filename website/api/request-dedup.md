# RequestDedup

Coalesces identical concurrent requests into a single network call.

Only `GET` and `HEAD` are coalesced by default, and the request body is part of the
key — a mismatch there would hand one caller another caller's response.

```typescript
import { RequestDedup } from 'super-http'
```

---

## Usage via HttpClient

```typescript
client.dedup()                                       // GET + HEAD
client.dedup({ methods: ['GET', 'HEAD', 'POST'] })   // opt in deliberately
```

---

## Direct usage

```typescript
const dedup = new RequestDedup()

const [a, b, c] = await Promise.all([
  dedup.execute('GET:/users/1', () => client.get('/users/1')),
  dedup.execute('GET:/users/1', () => client.get('/users/1')),
  dedup.execute('GET:/users/1', () => client.get('/users/1')),
])
// callCount = 1, a === b === c
```

---

## API

### `execute<T>(key, fn)`

```typescript
execute<T>(key: string, fn: () => Promise<T>): Promise<T>
```

Executes `fn`, coalescing concurrent calls with the same `key`. Once the request
settles, the entry is removed — subsequent calls start fresh.

Entries also expire after `ttlMs` (default 30 s, set via the constructor), so a
request that never settles stops pinning its key and dragging every later identical
call into the same doomed promise.

### `size`

```typescript
get size(): number
```

Number of in-flight deduplicated requests.

---

## Key format (via HttpClient)

When using `.dedup()` on `HttpClient`, the key is computed from the method, the
URL, the query params **and the request body**:

```
METHOD:url:sha1(params):sha1(body)
```

A request is **not** deduplicated at all when:

- its method is outside the eligible set (`GET`/`HEAD` by default), or
- its body cannot be compared byte-for-byte — a stream, a `FormData`, a circular
  object. Skipping the optimisation costs one extra request; matching wrongly
  would return the wrong data.

```typescript
import { buildDedupKey, DEFAULT_DEDUP_METHODS } from 'super-http'
```

::: warning Fixed in 2.0
Before 2.0 the key was `METHOD:url:JSON(params)` — the body was **not** part of it.
Two concurrent `POST`s with different payloads collapsed into one call and the
second caller received the first one's response.
:::

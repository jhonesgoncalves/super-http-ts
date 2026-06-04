# RequestDedup

Coalesces identical concurrent requests into a single network call.

```typescript
import { RequestDedup } from 'super-http'
```

---

## Usage via HttpClient

```typescript
client.dedup()
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

Executes `fn`, coalescing concurrent calls with the same `key`. Once the request settles, the entry is removed — subsequent calls start fresh.

### `size`

```typescript
get size(): number
```

Number of in-flight deduplicated requests.

---

## Key format (via HttpClient)

When using `.dedup()` on `HttpClient`, the key is automatically computed as:

```
METHOD:url:JSON(params)
```

e.g. `GET:/users/1:""` or `GET:/search:"{"q":"foo"}"`

# HttpClientFactory

Low-level singleton factory that creates and caches `HttpClient` instances keyed by `baseURL`.

::: tip Prefer `createClient` for new code
`createClient` is built on top of `HttpClientFactory` and provides a more ergonomic API with preset support. Use `HttpClientFactory.create()` when you need the explicit three-argument signature or direct access to the cache.

See [createClient vs HttpClientFactory](../guide/configuration#createclient-vs-httpclientfactory) for when to use each.
:::

---

## `HttpClientFactory.create()`

```typescript
static create(
  baseURL: string,
  httpConfig?: HttpClientRequestConfig,
  poolConfig?: PoolConfig
): HttpClient
```

Returns the cached `HttpClient` for `baseURL`, or creates a new one.

**Subsequent calls with the same URL return the same instance** — `httpConfig` and `poolConfig` are **ignored** on cache hits. If you need a fresh client for the same URL, call `HttpClientFactory.clear()` first.

### Parameters

| Name | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests |
| `httpConfig` | `HttpClientRequestConfig` | Default Axios config (headers, auth, timeout…) |
| `poolConfig` | `PoolConfig` | Connection pool options |

### Example

```typescript
import { HttpClientFactory, ExponentialJitterRetryStrategy } from 'super-http'

const api = HttpClientFactory.create(
  'https://api.example.com',
  { headers: { Authorization: `Bearer ${token}` } },
  { maxSockets: 100, timeout: 15_000 },
)

api
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, new ExponentialJitterRetryStrategy(100, 5_000))

const { data } = await api.get('/users')
```

---

## `HttpClientFactory.clear()`

```typescript
static clear(): void
```

Removes **all** cached instances from the shared cache.

This affects both `HttpClientFactory.create()` and `createClient()` — they share the same cache.

Primary use case: **tests**, to ensure each test starts with a fresh client and pool.

```typescript
import { HttpClientFactory } from 'super-http'

afterEach(() => HttpClientFactory.clear())
```

---

## Shared cache with createClient

`createClient` calls `HttpClientFactory.create()` internally. The two APIs share the same singleton cache:

```typescript
import { createClient, HttpClientFactory } from 'super-http'

const a = createClient({ baseURL: 'https://api.example.com' })
const b = HttpClientFactory.create('https://api.example.com')

console.log(a === b) // true — same instance
```

```typescript
// Either API resets the shared cache
HttpClientFactory.clear()
```

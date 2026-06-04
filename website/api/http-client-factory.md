# HttpClientFactory

Factory that creates and caches `HttpClient` instances keyed by `baseURL`.

---

## `HttpClientFactory.create()`

```typescript
static create(
  baseURL: string,
  httpConfig?: HttpClientRequestConfig,
  poolConfig?: PoolConfig
): HttpClient
```

Returns the cached `HttpClient` for `baseURL`, or creates a new one. Subsequent calls with the same URL return the **same instance** — `httpConfig` and `poolConfig` are ignored on cache hits.

### Parameters

| Name | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests |
| `httpConfig` | `HttpClientRequestConfig` | Default Axios config (headers, auth…) |
| `poolConfig` | `PoolConfig` | Connection pool options |

### Returns

`HttpClient`

### Example

```typescript
import { HttpClientFactory } from 'super-http'

const client = HttpClientFactory.create('https://api.example.com', {
  headers: { Authorization: `Bearer ${token}` },
}, {
  maxSockets: 100,
  timeout: 15_000,
})

client
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500)

const { data } = await client.get('/users')
```

---

## `HttpClientFactory.clear()`

```typescript
static clear(): void
```

Removes all cached instances. Primarily for use in tests.

```typescript
afterEach(() => HttpClientFactory.clear())
```

# Configuration Reference

## HttpClientFactory.create

```typescript
HttpClientFactory.create(baseURL, httpConfig?, poolConfig?)
```

| Parameter | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL prepended to every request path |
| `httpConfig` | `HttpClientRequestConfig` | Default Axios config (headers, auth, params…) |
| `poolConfig` | `PoolConfig` | Connection pool options |

---

## PoolConfig

| Option | Type | Default | Description |
|---|---|---|---|
| `maxSockets` | `number` | `50` | Max concurrent open sockets per host |
| `maxFreeSockets` | `number` | `10` | Max idle keep-alive sockets per host |
| `keepAlive` | `boolean` | `true` | Enable TCP keep-alive |
| `keepAliveMsecs` | `number` | `1000` | Keep-alive probe interval (ms) |
| `timeout` | `number` | `30000` | Request timeout (ms) |

```typescript
HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,
  maxFreeSockets: 20,
  keepAlive: true,
  keepAliveMsecs: 2_000,
  timeout: 15_000,
})
```

---

## .retry(retries, delayMs, retryOn?)

| Parameter | Type | Description |
|---|---|---|
| `retries` | `number` | Maximum retry attempts |
| `delayMs` | `number` | Fixed delay between attempts (ms) |
| `retryOn` | `number[]` | Optional: retry only on these HTTP status codes |

```typescript
client.retry(3, 500)             // default: network errors + 5xx
client.retry(3, 500, [429, 503]) // only retry 429 and 503
```

---

## .circuitBreak(config)

### CircuitBreakerConfig

| Option | Type | Description |
|---|---|---|
| `failureThreshold` | `number` | Failures before circuit opens |
| `successThreshold` | `number` | Successes (in half-open) before circuit closes |
| `timeoutMs` | `number` | Time circuit stays open before probing (ms) |

```typescript
client.circuitBreak({
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 10_000,
})
```

---

## HttpClient methods

| Method | Signature | Description |
|---|---|---|
| `get` | `get<T>(url, config?)` | HTTP GET |
| `post` | `post<T>(url, data?, config?)` | HTTP POST |
| `put` | `put<T>(url, data?, config?)` | HTTP PUT |
| `patch` | `patch<T>(url, data?, config?)` | HTTP PATCH |
| `delete` | `delete<T>(url, config?)` | HTTP DELETE |
| `request` | `request<T>(config)` | Raw Axios config |
| `retry` | `retry(n, ms, codes?)` | Configure retry — returns `this` |
| `circuitBreak` | `circuitBreak(config)` | Configure circuit breaker — returns `this` |

---

## HttpClientFactory.clear()

Clears all cached singleton instances. Primarily for tests.

```typescript
afterEach(() => HttpClientFactory.clear())
```

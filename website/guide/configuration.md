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
| `maxSockets` | `number` | `50` | Max concurrent sockets per host |
| `maxFreeSockets` | `number` | `10` | Max idle keep-alive sockets |
| `keepAlive` | `boolean` | `true` | Enable TCP keep-alive |
| `keepAliveMsecs` | `number` | `1000` | Keep-alive probe interval (ms) |
| `timeout` | `number` | `30000` | Request timeout (ms) |

---

## .retry(retries, strategy, retryOn?)

| Parameter | Type | Description |
|---|---|---|
| `retries` | `number` | Max retry attempts |
| `strategy` | `RetryStrategy \| number` | Delay strategy or fixed ms |
| `retryOn` | `number[]` | Optional: retry only on these status codes |

**Strategies:**

| Class | Delay pattern |
|---|---|
| `FixedRetryStrategy(ms)` | Constant |
| `ExponentialRetryStrategy(init, max, factor?)` | Doubles each attempt |
| `ExponentialJitterRetryStrategy(init, max, factor?)` | Random in [0, exponential cap] |
| `RetryAfterStrategy(init?, max?, factor?)` | From header, jitter fallback |

---

## .circuitBreak(config)

| Option | Type | Description |
|---|---|---|
| `failureThreshold` | `number` | Failures before circuit opens |
| `successThreshold` | `number` | Successes to close from half-open |
| `timeoutMs` | `number` | Open duration before probing (ms) |

---

## .bulkhead(config)

| Option | Type | Default | Description |
|---|---|---|---|
| `maxConcurrent` | `number` | — | Max in-flight requests |
| `maxQueue` | `number` | `50` | Max queued requests |
| `queueTimeoutMs` | `number` | `undefined` | Reject queued after this ms |

---

## .rateLimit(config)

| Option | Type | Default | Description |
|---|---|---|---|
| `permitLimit` | `number` | — | Max requests per window |
| `windowMs` | `number` | — | Window size in ms |
| `queueRequests` | `boolean` | `false` | Queue excess instead of rejecting |
| `queueTimeoutMs` | `number` | `undefined` | Max wait time for queued token |

---

## .fallback(fn)

```typescript
client.fallback((error: unknown) => fallbackValue)
client.fallback(async (error: unknown) => await alternativeSource())
```

---

## .dedup()

No configuration — enables request deduplication for this client.

---

## .on(events)

| Hook | Event type | Fired when |
|---|---|---|
| `onRetry` | `RetryEvent` | Before each retry attempt |
| `onCircuitStateChange` | `CircuitStateChangeEvent` | On circuit state transition |
| `onBulkheadReject` | `BulkheadRejectEvent` | Bulkhead queue full |
| `onFallback` | `FallbackEvent` | Fallback handler invoked |
| `onRateLimitReject` | `RateLimitRejectEvent` | Rate limit token unavailable |

---

## HttpClient HTTP methods

| Method | Signature |
|---|---|
| `get` | `get<T>(url, config?)` |
| `post` | `post<T>(url, data?, config?)` |
| `put` | `put<T>(url, data?, config?)` |
| `patch` | `patch<T>(url, data?, config?)` |
| `delete` | `delete<T>(url, config?)` |
| `request` | `request<T>(axiosConfig)` |

---

## HttpClientFactory

| Method | Description |
|---|---|
| `HttpClientFactory.create(url, cfg?, pool?)` | Get or create singleton client |
| `HttpClientFactory.clear()` | Clear all cached instances (tests) |

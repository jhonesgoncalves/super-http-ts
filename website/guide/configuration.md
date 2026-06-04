# Configuration Reference

## createClient vs HttpClientFactory

Both APIs create and cache `HttpClient` instances. Choose based on your needs:

| | `createClient` | `HttpClientFactory.create` |
|---|---|---|
| **API style** | Single options object | Three positional arguments |
| **Preset support** | ✅ `preset: 'resilient-api'` | ❌ |
| **Ergonomics** | Flat config, easy to read | Explicit separation of concerns |
| **Shared cache** | ✅ same cache | ✅ same cache |
| **Recommended for** | New projects, preset users | Advanced use, explicit control |

::: code-group

```typescript [createClient (recommended)]
import { createClient } from 'super-http'

const api = createClient({
  baseURL: 'https://api.example.com',
  preset: 'resilient-api',            // preset applies circuit breaker + retry + bulkhead
  headers: { 'X-Service': 'checkout' },
  pool: { maxSockets: 150 },          // override one pool setting
})
```

```typescript [HttpClientFactory.create]
import { HttpClientFactory } from 'super-http'

const api = HttpClientFactory.create(
  'https://api.example.com',
  { headers: { 'X-Service': 'checkout' } },   // http config
  { maxSockets: 150, timeout: 15_000 },         // pool config
)

// add resilience manually
api
  .circuitBreak({ failureThreshold: 10, successThreshold: 3, timeoutMs: 10_000 })
  .retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
  .bulkhead({ maxConcurrent: 50, maxQueue: 200 })
```

:::

Both share the same cache. The following two calls return the **same instance**:

```typescript
const a = createClient({ baseURL: 'https://api.example.com' })
const b = HttpClientFactory.create('https://api.example.com')
console.log(a === b) // true
```

---

## PoolConfig

Passed as `pool` in `createClient`, or as the third argument in `HttpClientFactory.create`.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxSockets` | `number` | `50` | Max concurrent sockets per host |
| `maxFreeSockets` | `number` | `10` | Max idle keep-alive sockets |
| `keepAlive` | `boolean` | `true` | Enable TCP keep-alive |
| `keepAliveMsecs` | `number` | `1000` | Keep-alive probe interval (ms) |
| `timeout` | `number` | `30000` | Request timeout (ms) |

```typescript
createClient('https://api.example.com', {}, {
  maxSockets: 100,
  maxFreeSockets: 20,
  keepAlive: true,
  keepAliveMsecs: 2_000,
  timeout: 15_000,
})
```

---

## .retry(retries, strategy, retryOn?)

| Parameter | Type | Description |
|---|---|---|
| `retries` | `number` | Max retry attempts |
| `strategy` | `RetryStrategy \| number` | Delay strategy or fixed ms |
| `retryOn` | `number[]` | Optional: retry only on these HTTP status codes |

**Strategies:**

| Class | Delay pattern |
|---|---|
| `FixedRetryStrategy(ms)` | Constant |
| `ExponentialRetryStrategy(init, max, factor?)` | Doubles each attempt |
| `ExponentialJitterRetryStrategy(init, max, factor?)` ⭐ | Random in [0, cap] — recommended |
| `RetryAfterStrategy(init?, max?, factor?)` | From `Retry-After` header, jitter fallback |

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

No configuration — enables request deduplication (idempotent calls only).

---

## .use(plugin)

```typescript
import { LoggerPlugin, MetricsReporterPlugin } from 'super-http'

client.use(LoggerPlugin({ prefix: '[my-service]', level: 'info' }))
client.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
```

---

## Per-request policy

Any resilience setting can be overridden for a single request via `policy`:

```typescript
// Disable retry for a payment (non-idempotent)
await api.post('/charges', payload, {
  policy: { retry: false, timeout: 10_000 },
})

// Silent fallback for non-critical endpoint
await api.get('/recommendations', {
  policy: { timeout: 300, fallback: () => [] },
})

// Stricter circuit breaker on one endpoint
await api.get('/inventory', {
  policy: {
    circuitBreaker: { failureThreshold: 2, successThreshold: 1, timeoutMs: 3_000 },
  },
})
```

| `policy` field | Type | Description |
|---|---|---|
| `timeout` | `number` | Override timeout for this request (ms) |
| `retry` | `{ attempts, delayMs?, retryOn? } \| false` | Override retry, or `false` to disable |
| `circuitBreaker` | `Partial<CircuitBreakerConfig> \| false` | Override CB config, or `false` to bypass |
| `fallback` | `(error) => T` | Override fallback for this request |

---

## .on(events)

| Hook | Event type | Fired when |
|---|---|---|
| `onRequest` | `AxiosRequestConfig` | Before each HTTP request |
| `onResponse` | `AxiosResponse` | On successful response |
| `onError` | `unknown` | On final failure |
| `onRetry` | `RetryEvent` | Before each retry attempt |
| `onCircuitStateChange` | `CircuitStateChangeEvent` | On circuit state transition |
| `onBulkheadReject` | `BulkheadRejectEvent` | Bulkhead queue full |
| `onFallback` | `FallbackEvent` | Fallback handler invoked |
| `onRateLimitReject` | `RateLimitRejectEvent` | Rate limit token unavailable |

---

## .metrics() / .resetMetrics()

```typescript
const m = client.metrics()
// { requests, success, failed, retries, circuitBreakerTrips,
//   bulkheadRejects, rateLimitRejects, fallbacks,
//   avgLatency, p50Latency, p95Latency, p99Latency, uptime }

client.resetMetrics() // clear all counters
```

---

## HttpClientFactory.clear()

Clears all cached singleton instances (shared between `createClient` and `HttpClientFactory.create`).

```typescript
import { HttpClientFactory } from 'super-http'

afterEach(() => HttpClientFactory.clear()) // tests
```

---

## HTTP methods

| Method | Signature |
|---|---|
| `get` | `get<T>(url, config?)` |
| `post` | `post<T>(url, data?, config?)` |
| `put` | `put<T>(url, data?, config?)` |
| `patch` | `patch<T>(url, data?, config?)` |
| `delete` | `delete<T>(url, config?)` |
| `request` | `request<T>(axiosConfig)` |

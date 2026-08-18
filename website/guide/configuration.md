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
| `maxSockets` | `number` | `200` | Max concurrent sockets per host (≥ 1) |
| `maxFreeSockets` | `number` | `50` | Max idle keep-alive sockets |
| `keepAlive` | `boolean` | `true` | Enable TCP keep-alive |
| `keepAliveMsecs` | `number` | `1000` | Keep-alive probe interval (ms) |
| `timeout` | `number` | `30000` | Response timeout (ms) |
| `socketTimeoutMs` | `number` | = `timeout` | Socket inactivity timeout on the agent |
| `maxContentLength` | `number` | `33554432` | Max response body accepted (bytes) |
| `maxBodyLength` | `number` | `33554432` | Max request body sent (bytes) |

```typescript
createClient('https://api.example.com', {}, {
  maxSockets: 200,
  maxFreeSockets: 50,
  keepAlive: true,
  keepAliveMsecs: 2_000,
  timeout: 15_000,
  socketTimeoutMs: 15_000,
})
```

`timeout` is the axios response timeout. `socketTimeoutMs` reaches the agent and
bounds socket inactivity — that is what catches a connection silently dropped by a
NAT or firewall. Body limits default to 32 MiB, where axios itself is unlimited.

---

## .deadline(ms)

Total time budget for every request: queue waits, all attempts and all backoff
combined. See [Deadlines & Cancellation](./deadlines).

```typescript
client.deadline(2_000)
```

---

## .retry(retries, strategy, options?)

| Parameter | Type | Description |
|---|---|---|
| `retries` | `number` | Max retry attempts (≥ 0) |
| `strategy` | `RetryStrategy \| number` | Delay strategy or fixed ms |
| `options` | `number[] \| RetryOptions` | Status codes to add, or an options object |

```typescript
client.retry(3, 500, [429, 503])                      // add these statuses
client.retry(3, 500, { retryNonIdempotent: true })    // allow POST/PATCH retries
```

| `RetryOptions` | Type | Default | Description |
|---|---|---|---|
| `retryOn` | `number[]` | — | Extra statuses, **on top of** the network-error rules |
| `retryNonIdempotent` | `boolean` | `false` | Retry `POST`/`PATCH` on ambiguous errors |

Ambiguous errors (`ECONNRESET`, `ETIMEDOUT`, `ECONNABORTED`, `EPIPE`, 5xx) are
retried only for idempotent methods unless `retryNonIdempotent` is set. See
[Retry Strategies](./retry#what-gets-retried).

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
| `failureThreshold` | `number` | Consecutive counted failures before the circuit opens (≥ 1) |
| `successThreshold` | `number` | Successes to close from half-open (≥ 1) |
| `timeoutMs` | `number` | Open duration before probing (ms) |
| `shouldTrip` | `(error) => boolean` | Which errors count. Defaults to network errors and 5xx only |

---

## .bulkhead(config)

| Option | Type | Default | Description |
|---|---|---|---|
| `maxConcurrent` | `number` | — | Max in-flight requests (≥ 1) |
| `maxQueue` | `number` | `50` | Max queued requests |
| `queueTimeoutMs` | `number` | `10000` | Reject queued after this ms. `Infinity` waits indefinitely |

---

## .rateLimit(config)

| Option | Type | Default | Description |
|---|---|---|---|
| `permitLimit` | `number` | — | Max requests per window (≥ 1) |
| `windowMs` | `number` | — | Window size in ms (≥ 1) |
| `queueRequests` | `boolean` | `false` | Queue excess instead of rejecting |
| `queueTimeoutMs` | `number` | `10000` | Max wait for a queued token. `Infinity` waits indefinitely |
| `maxQueue` | `number` | `1000` | Max requests allowed to wait for a token |

---

## .fallback(fn)

```typescript
client.fallback((error: unknown) => fallbackValue)
client.fallback(async (error: unknown) => await alternativeSource())
```

---

## .dedup(options?)

Coalesces identical concurrent requests. Only `GET` and `HEAD` by default, and the
request body is part of the key.

| Option | Type | Default | Description |
|---|---|---|---|
| `methods` | `string[]` | `['GET','HEAD']` | Methods eligible for coalescing |

```typescript
client.dedup()
client.dedup({ methods: ['GET', 'HEAD', 'POST'] })  // opt in deliberately
```

---

## .correlate(options?)

Attaches a per-request id to every resilience event and sends it upstream.

| Option | Type | Default | Description |
|---|---|---|---|
| `header` | `string` | `'x-request-id'` | Header carrying the id |
| `generate` | `() => string` | `crypto.randomUUID` | Id generator |

---

## .state()

Current state of every configured component — see
[Observability](./observability#current-state).

---

## .close()

Destroys both agents' sockets and clears plugin timers. Call it on shutdown.

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
| `timeout` | `number` | Override the per-attempt timeout (ms) |
| `deadlineMs` | `number` | Total budget for this call: queue waits + attempts + backoff |
| `signal` | `AbortSignal` | Cancel the whole call, including queue waits and backoff |
| `retry` | `{ attempts, delayMs?, retryOn?, retryNonIdempotent? } \| false` | Override retry, or `false` to disable |
| `circuitBreaker` | `Partial<CircuitBreakerConfig> \| false` | Override CB config, or `false` to bypass |
| `fallback` | `(error) => T` | Override fallback for this request |

A `policy.circuitBreaker` override gets its **own** breaker instance, with its own
failure counter — it does not reconfigure the client's.

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

Handlers accumulate: two `on()` calls for the same hook register both, and all run.
With `correlate()` enabled, every event carries a `requestId`.

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

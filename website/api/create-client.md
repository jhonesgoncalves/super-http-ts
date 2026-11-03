# createClient

The recommended entry point for super-http. Wraps `HttpClientFactory.create()` with preset support and a single-object API.

```typescript
import { createClient } from 'super-http'
```

---

## How it relates to HttpClientFactory

`createClient` is built on top of `HttpClientFactory`:

```
createClient({ baseURL, preset?, capacity?, deadlineMs?, pool?, ...httpConfig })
    ↓
HttpClientFactory.create(baseURL, httpConfig, mergedPool)
    ↓
  initializes preset once, before caching (if any)
    ↓
returns HttpClient (singleton per baseURL)
```

Both share the **same singleton cache** — `HttpClientFactory.clear()` resets clients created by either API.

---

## Signature

```typescript
function createClient(options: CreateClientOptions): HttpClient

interface CreateClientOptions extends HttpClientRequestConfig {
  baseURL: string
  isolated?: boolean // default false
  preset?: 'high-throughput' | 'resilient-api' | 'low-latency'
  capacity?: number // positive integer; requires preset; per-client concurrency
  deadlineMs?: number // positive integer; total logical-call budget
  pool?: PoolConfig
}
```

| Field | Type | Description |
|---|---|---|
| `baseURL` | `string` | **Required.** Base URL for all requests |
| `isolated` | `boolean` | Bypass the global cache; the caller owns shutdown |
| `preset` | `Preset` | Optional resilience preset — see [Presets](../guide/presets) |
| `capacity` | `number` | Coordinates pool and bulkhead concurrency, idle reserve and queue |
| `deadlineMs` | `number` | Total call budget including admission, attempts and backoff |
| `pool` | `PoolConfig` | Pool options, merged with preset defaults |
| `headers` | `Record<string,string>` | Default headers on every request |
| `timeout` | `number` | Default timeout in ms (overridden by `pool.timeout` if set) |
| `auth` | `AxiosBasicCredentials` | Basic auth |
| `...` | `HttpClientRequestConfig` | Any Axios request config |

---

## Examples

::: code-group

```typescript [Plain]
const api = createClient({ baseURL: 'https://api.example.com' })

// Identical to:
// HttpClientFactory.create('https://api.example.com')
```

```typescript [With preset]
const payments = createClient({
  baseURL: 'https://payments.internal',
  preset: 'resilient-api',
  headers: { Authorization: `Bearer ${KEY}` },
})
// Includes: managed pool + deadline + safe retry + circuit breaker + bulkhead
```

```typescript [Capacity override]
const catalog = createClient({
  baseURL: 'https://catalog.internal',
  preset: 'high-throughput',
  capacity: 64,  // derive pool and admission limits together
})
```

```typescript [Manual config]
const api = createClient({ baseURL: 'https://api.example.com' })

// Apply resilience manually after creation
api
  .retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .use(LoggerPlugin())
```

:::

---

## Preset defaults

| Preset | Capacity | Attempt timeout | Total deadline | Additional retries | Breaker open period | Bulkhead queue / wait |
|---|---:|---:|---:|---:|---:|---|
| `high-throughput` | 128 | 2 s | 5 s | 1 | 5 s | 256 / 100 ms |
| `resilient-api` | 32 | 1.5 s | 3 s | 1 | 5 s | 64 / 200 ms |
| `low-latency` | 32 | 500 ms | 1 s | 0 | 2 s | 64 / 25 ms |

All profiles use bounded admission and a breaker with 10 consecutive counted
failures / one successful probe. See [Presets](../guide/presets) for lifecycle
settings, sizing and retry safety, and [Migration](../guide/migration-3) for 2.x.

::: tip
Preset settings can always be overridden — call `.retry()`, `.circuitBreak()`, etc. after `createClient()`. Manual method calls always take precedence over the preset.
:::

---

## Singleton behaviour

Unless `isolated: true`, repeated calls with the same URL share the open instance.
Pool, headers and resilience policies are first-call-wins. A later preset does
not reset an existing breaker, replace admission queues or change fluent settings. Use isolated clients for different policies:

```typescript
const a = createClient({ baseURL: 'https://api.example.com', preset: 'resilient-api' })
const b = createClient({ baseURL: 'https://api.example.com' })

console.log(a === b) // true
```

To create a fresh client for the same URL (e.g. in tests):

```typescript
import { HttpClientFactory } from 'super-http'

afterEach(() => HttpClientFactory.clear())
```

For independent ownership, use `createClient({ baseURL, isolated: true })` and close it at shutdown.

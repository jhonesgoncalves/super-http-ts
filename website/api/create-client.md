# createClient

The recommended entry point for super-http. Wraps `HttpClientFactory.create()` with preset support and a single-object API.

```typescript
import { createClient } from 'super-http'
```

---

## How it relates to HttpClientFactory

`createClient` is built on top of `HttpClientFactory`:

```
createClient({ baseURL, preset?, pool?, ...httpConfig })
    ↓
HttpClientFactory.create(baseURL, httpConfig, mergedPool)
    ↓
  applies preset defaults (if any)
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
  pool?: PoolConfig
}
```

| Field | Type | Description |
|---|---|---|
| `baseURL` | `string` | **Required.** Base URL for all requests |
| `isolated` | `boolean` | Bypass the global cache; the caller owns shutdown |
| `preset` | `Preset` | Optional resilience preset — see [Presets](../guide/presets) |
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
// Includes: circuit breaker + retry + bulkhead, all pre-configured
```

```typescript [Pool override]
const catalog = createClient({
  baseURL: 'https://catalog.internal',
  preset: 'high-throughput',
  pool: { maxSockets: 300 },  // override one pool value, keep rest
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

| Preset | maxSockets | timeout | retry | circuit breaker | bulkhead |
|---|---|---|---|---|---|
| `high-throughput` | 200 | 5 s | 1× jitter (50–500ms) | — | — |
| `resilient-api` | 100 | 15 s | 3× jitter (100–10s) | fail@10, recover@10s | 50c / queue 200 |
| `low-latency` | 500 | 2 s | — | — | — |

::: tip
Preset settings can always be overridden — call `.retry()`, `.circuitBreak()`, etc. after `createClient()`. Manual method calls always take precedence over the preset.
:::

---

## Singleton behaviour

Unless `isolated: true`, repeated calls with the same URL share the open instance.
Pool/header configuration is first-call-wins; an explicitly supplied preset is
reapplied to the shared instance. Use isolated clients for different policies:

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

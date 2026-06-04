# createClient

The recommended way to create an `HttpClient` with optional preset configuration.

```typescript
import { createClient } from 'super-http'
```

---

## Signature

```typescript
function createClient(options: CreateClientOptions): HttpClient
```

---

## CreateClientOptions

```typescript
interface CreateClientOptions extends HttpClientRequestConfig {
  baseURL: string
  preset?: 'high-throughput' | 'resilient-api' | 'low-latency'
  pool?: PoolConfig
}
```

| Field | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests |
| `preset` | `Preset` | Optional resilience preset |
| `pool` | `PoolConfig` | Connection pool overrides |
| `...` | `HttpClientRequestConfig` | Any Axios config option (headers, auth, timeout…) |

---

## Examples

```typescript
// Plain client (no preset)
const api = createClient({ baseURL: 'https://api.example.com' })

// With preset
const payments = createClient({
  baseURL: 'https://payments.internal',
  preset: 'resilient-api',
  headers: { Authorization: `Bearer ${KEY}` },
})

// Preset + pool override
const catalog = createClient({
  baseURL: 'https://catalog.internal',
  preset: 'high-throughput',
  pool: { maxSockets: 300 },
})
```

---

## Preset defaults

| Preset | maxSockets | timeout | retry | circuit breaker |
|---|---|---|---|---|
| `high-throughput` | 200 | 5 s | 1× jitter | — |
| `resilient-api` | 100 | 15 s | 3× jitter | failureThreshold: 10, timeoutMs: 10s |
| `low-latency` | 500 | 2 s | — | — |

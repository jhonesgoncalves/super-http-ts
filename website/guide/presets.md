# Presets

Presets are named configuration bundles that apply sensible resilience defaults with a single option. They're designed to cover 90% of use cases without needing to understand every individual setting.

---

## Usage

```typescript
import { createClient } from 'super-http'

const api = createClient({
  baseURL: 'https://api.example.com',
  preset: 'resilient-api',
})
```

Any preset setting can be overridden — call `.retry()`, `.circuitBreak()`, etc. after `createClient` to customise.

---

## Available presets

### `high-throughput`

Maximum throughput for internal services and high-volume read paths.

```typescript
createClient({ baseURL: '...', preset: 'high-throughput' })
```

**What it configures:**
- Pool: `maxSockets: 200`, `maxFreeSockets: 50`, `keepAlive: true`
- Timeout: `5 000 ms`
- Retry: 1 attempt, jitter (50–500 ms)
- Circuit breaker: none
- Bulkhead: none

**When to use:**
- Internal microservice calls
- High-volume read APIs
- Services where failures are acceptable

---

### `resilient-api`

Full resilience for external or business-critical APIs.

```typescript
createClient({ baseURL: '...', preset: 'resilient-api' })
```

**What it configures:**
- Pool: `maxSockets: 100`, `maxFreeSockets: 20`, `keepAlive: true`
- Timeout: `15 000 ms`
- Retry: 3 attempts, exponential jitter (100–10 000 ms)
- Circuit breaker: trips at 10 failures, recovers after 10 s
- Bulkhead: 50 concurrent, 200 queued, 5 s queue timeout

**When to use:**
- External payment APIs
- Third-party integrations
- Any service where failures cascade

---

### `low-latency`

Minimum latency, zero safety nets. For real-time features where stale data is worse than no data.

```typescript
createClient({ baseURL: '...', preset: 'low-latency' })
```

**What it configures:**
- Pool: `maxSockets: 500`, `maxFreeSockets: 100`, `keepAlive: true`
- Timeout: `2 000 ms`
- Retry: none
- Circuit breaker: none
- Bulkhead: none

**When to use:**
- Real-time dashboards
- WebSocket fallbacks
- Streaming endpoints

---

## Pool overrides

Pass a `pool` option to override specific pool settings while keeping the rest of the preset:

```typescript
// resilient-api with a larger pool
createClient({
  baseURL: 'https://payments.api',
  preset: 'resilient-api',
  pool: { maxSockets: 200 },  // override one value
})
```

---

## Combining presets with manual config

```typescript
import { createClient, ExponentialJitterRetryStrategy, LoggerPlugin } from 'super-http'

const payments = createClient({
  baseURL: 'https://payments.api',
  preset: 'resilient-api',
  headers: { Authorization: `Bearer ${KEY}` },
})

// Add a logger on top of the preset
payments.use(LoggerPlugin({ prefix: '[payments]' }))

// Override CB config from the preset
payments.circuitBreak({ failureThreshold: 5, successThreshold: 1, timeoutMs: 5_000 })
```

---

## Custom preset pattern

If you need the same config across multiple services, create your own factory:

```typescript
import { createClient, ExponentialJitterRetryStrategy } from 'super-http'

export function createInternalClient(baseURL: string) {
  return createClient({
    baseURL,
    preset: 'high-throughput',
    headers: { 'X-Service': process.env.SERVICE_NAME },
  })
}

export const usersApi   = createInternalClient('https://users.internal')
export const catalogApi = createInternalClient('https://catalog.internal')
```

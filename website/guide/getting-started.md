# Getting Started

## Installation

::: code-group
```bash [npm]
npm install super-http
```
```bash [yarn]
yarn add super-http
```
```bash [pnpm]
pnpm add super-http
```
:::

::: info Requirements
Node.js ≥ 20 · TypeScript ≥ 5
:::

---

## Two ways to create a client

super-http offers two factory APIs. Both return an `HttpClient` and share the same singleton cache per `baseURL`.

### `createClient` — recommended

The modern, ergonomic API. Accepts all config in a single options object and supports **presets**.

```typescript
import { createClient } from 'super-http'

const api = createClient({
  baseURL: 'https://api.example.com',
  preset: 'resilient-api',           // optional preset
  headers: { 'X-Service': 'checkout' },
})
```

### `HttpClientFactory.create` — explicit

The low-level API. Useful when you need to separate `httpConfig` from `poolConfig`, or when you don't want a preset.

```typescript
import { HttpClientFactory } from 'super-http'

const api = HttpClientFactory.create(
  'https://api.example.com',
  { headers: { 'X-Service': 'checkout' } },  // http config
  { maxSockets: 100, timeout: 15_000 },       // pool config
)
```

::: tip Both share the same cache
`createClient` is built on top of `HttpClientFactory`. A given `baseURL` always returns the same `HttpClient` instance regardless of which API you used to create it.
:::

---

## Your first request

```typescript
import { createClient } from 'super-http'

const client = createClient({ baseURL: 'https://jsonplaceholder.typicode.com' })

const { data } = await client.get('/todos/1')
// { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
```

Out of the box: shared **connection pool** with TCP keep-alive, 30 s timeout, and a `CircuitBreaker` instance — all automatic.

---

## Production setup

```typescript
import { createClient, ExponentialJitterRetryStrategy, LoggerPlugin } from 'super-http'

// Option A — preset (recommended for most cases)
const api = createClient({
  baseURL: 'https://api.example.com',
  preset: 'resilient-api',
  headers: { Authorization: `Bearer ${token}` },
})

// Option B — manual setup (full control)
const api = createClient({ baseURL: 'https://api.example.com' })

api
  .use(LoggerPlugin({ prefix: '[checkout]' }))
  .on({
    onCircuitStateChange: ({ to, failures }) =>
      to === 'open' && alerts.send(`Circuit opened (${failures} failures)`),
  })
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
  .bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
  .rateLimit({ permitLimit: 200, windowMs: 60_000 })
  .fallback(() => ({ items: [], degraded: true }))
  .dedup()
```

---

## Typed responses

```typescript
interface User { id: number; name: string; email: string }

const { data } = await api.get<User[]>('/users')
//     ^ User[]  — fully typed
```

---

## Per-request policy

Override any resilience setting for a single call without changing the client:

```typescript
// Disable retry for a non-idempotent payment
const charge = await api.post('/charges', payload, {
  policy: { retry: false, timeout: 10_000 },
  headers: { 'Idempotency-Key': uuid() },
})

// Fast fallback for a non-critical endpoint
const recs = await api.get('/recommendations', {
  policy: { timeout: 300, fallback: () => [] },
})
```

---

## Built-in metrics

```typescript
const m = api.metrics()
// { requests, success, failed, retries, p95Latency, p99Latency, circuitBreakerTrips, … }
```

---

## Next steps

| Topic | Link |
|---|---|
| `createClient` vs `HttpClientFactory` | [Factory comparison](./configuration#createclient-vs-httpclientfactory) |
| Presets reference | [Presets](./presets) |
| Why super-http? | [Why](./why) |
| Migrating from Axios | [Migration guide](./migration) |
| All resilience features | [Configuration](./configuration) |
| Production patterns | [Recipes](./recipes) |
| Production checklist | [Production Readiness](./production-readiness) |

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

## Your first request

```typescript
import { HttpClientFactory } from 'super-http'

const client = HttpClientFactory.create('https://jsonplaceholder.typicode.com')

const { data } = await client.get('/todos/1')
console.log(data)
// { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
```

Already active out of the box: shared **connection pool** with TCP keep-alive, 30 s timeout, and an attached `CircuitBreaker`.

---

## Production setup

```typescript
import { HttpClientFactory, ExponentialJitterRetryStrategy } from 'super-http'

const api = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,   // connection pool size
  timeout: 15_000,   // request timeout
})

api
  // 1. Observability — wire to your logger / metrics
  .on({
    onRetry:              ({ attempt, delayMs }) => logger.warn(`retry #${attempt} in ${delayMs}ms`),
    onCircuitStateChange: ({ from, to })         => metrics.increment(`circuit.${from}_${to}`),
    onBulkheadReject:     ()                     => metrics.increment('bulkhead.rejected'),
    onFallback:           ({ error })            => logger.error('fallback triggered', error),
  })

  // 2. Circuit breaker — trip after 5 failures, recover after 15 s
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })

  // 3. Retry — exponential jitter prevents thundering herd
  .retry(4, new ExponentialJitterRetryStrategy(100, 10_000))

  // 4. Bulkhead — cap concurrency, queue up to 100 with 3 s timeout
  .bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })

  // 5. Rate limiter — 200 req/min
  .rateLimit({ permitLimit: 200, windowMs: 60_000 })

  // 6. Fallback — degrade gracefully instead of propagating errors
  .fallback(() => ({ items: [], degraded: true }))

  // 7. Dedup — coalesce identical concurrent GETs
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

## Next steps

| Topic | Link |
|---|---|
| Why super-http? | [Why](./why) |
| Connection pool deep dive | [Connection Pooling](./connection-pool) |
| Retry strategies | [Retry](./retry) |
| Circuit breaker | [Circuit Breaker](./circuit-breaker) |
| Bulkhead | [Bulkhead](./bulkhead) |
| Rate limiter | [Rate Limiter](./rate-limiter) |
| Fallback | [Fallback](./fallback) |
| Request dedup | [Request Dedup](./dedup) |
| Observability hooks | [Observability](./observability) |
| All options | [Configuration](./configuration) |
| Production patterns | [Recipes](./recipes) |

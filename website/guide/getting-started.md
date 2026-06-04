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

That's it. Behind the scenes super-http already:

- ✅ Created a shared **connection pool** with TCP keep-alive
- ✅ Set a 30-second request **timeout**
- ✅ Attached a **CircuitBreaker** to the client

---

## Adding resilience

### Retry

```typescript
client.retry(3, 500)
// up to 3 retries, 500 ms apart
// triggers on: ECONNRESET, ECONNREFUSED, ETIMEDOUT, EPIPE, 5xx
```

### Circuit breaker

```typescript
client.circuitBreak({
  failureThreshold: 5,  // trip after 5 consecutive failures
  successThreshold: 2,  // close after 2 consecutive successes
  timeoutMs: 10_000,    // stay open for 10 s before probing
})
```

### Chain both

```typescript
const api = HttpClientFactory.create('https://api.example.com')

api
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500)

const { data } = await api.get('/users')
```

---

## Typed responses

```typescript
interface User {
  id: number
  name: string
  email: string
}

const { data } = await client.get<User[]>('/users')
//     ^ User[]  — fully typed
```

---

## Next steps

- [Why super-http?](./why) — understand the problems it solves
- [Connection Pooling](./connection-pool) — deep dive into keep-alive and pools
- [Retry](./retry) — what gets retried and when
- [Circuit Breaker](./circuit-breaker) — state machine explained
- [Full Configuration](./configuration) — all options

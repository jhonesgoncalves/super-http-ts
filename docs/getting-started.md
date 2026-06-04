# Getting Started

## Installation

```bash
npm install super-http
# or
yarn add super-http
```

**Requirements:** Node.js ≥ 16

---

## Your first request

```typescript
import { HttpClientFactory } from 'super-http';

const client = HttpClientFactory.create('https://jsonplaceholder.typicode.com');

const { data } = await client.get('/todos/1');
console.log(data);
// { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
```

That's it. Behind the scenes super-http already:

- Created a shared connection pool with TCP keep-alive enabled
- Configured a 30-second request timeout
- Attached a `CircuitBreaker` instance to the client

---

## Adding resilience

### Retry on failure

```typescript
client.retry(3, 500); // up to 3 retries, 500 ms apart
```

Retries are triggered automatically for:
- Network errors: `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `EPIPE`, …
- HTTP 5xx responses

4xx responses are **never** retried (they indicate a client-side problem).

### Circuit breaker

```typescript
client.circuitBreak({
  failureThreshold: 5,   // trip after 5 consecutive failures
  successThreshold: 2,   // close after 2 consecutive successes
  timeoutMs: 10_000,     // stay open for 10 s before probing
});
```

### Chaining both

```typescript
const api = HttpClientFactory.create('https://api.example.com');

api
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500);

const { data } = await api.get('/users');
```

---

## Next steps

- [Configuration reference](./configuration.md)
- [Recipes & patterns](./recipes.md)
- [API reference](./api/)

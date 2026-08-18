# Recipes & Patterns

Common patterns for using super-http in production.

---

## Global singleton per service

The recommended pattern: one factory call per external service, shared across your entire app.

```typescript
// lib/clients.ts
import { HttpClientFactory } from 'super-http';

export const paymentsApi = HttpClientFactory.create('https://payments.internal', {
  headers: { 'X-Service': 'my-app' },
}, { maxSockets: 200, timeout: 10_000 })
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(3, 300);

export const catalogApi = HttpClientFactory.create('https://catalog.internal', {}, {
  maxSockets: 100,
  timeout: 5_000,
}).retry(2, 200);
```

```typescript
// anywhere in your app
import { paymentsApi } from './lib/clients';
const { data } = await paymentsApi.post('/charges', payload);
```

---

## Typed responses

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const { data } = await client.get<User[]>('/users');
//     ^ User[]  — fully typed
```

---

## Per-request headers (auth tokens, correlation IDs)

```typescript
const { data } = await client.get('/profile', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'X-Correlation-ID': requestId,
  },
});
```

---

## Retry only on rate-limiting (429)

```typescript
client.retry(5, 2000, [429]);
// waits 2 s between each retry, only triggered on HTTP 429
```

---

## Aggressive circuit breaker for non-critical services

```typescript
// Trip fast, recover fast — for optional enrichment services
client.circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 3_000 });
```

---

## Conservative circuit breaker for critical dependencies

```typescript
// Trip slowly, require sustained recovery
client.circuitBreak({ failureThreshold: 10, successThreshold: 5, timeoutMs: 30_000 });
```

---

## POST with query parameters

```typescript
const { data } = await client.post('/search', { query: 'foo' }, {
  params: { locale: 'pt-BR', page: 1 },
});
```

---

## Handling circuit-open errors gracefully

```typescript
import { HttpClientFactory } from 'super-http';

const client = HttpClientFactory.create('https://recommendations.internal')
  .circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 5_000 });

async function getRecommendations(userId: string) {
  try {
    const { data } = await client.get(`/users/${userId}/recommendations`);
    return data;
  } catch (err: any) {
    if (err.message === 'Circuit breaker is open') {
      // Fall back to a cached / default response
      return [];
    }
    throw err;
  }
}
```

---

## Testing with HttpClientFactory.clear()

```typescript
import { HttpClientFactory } from 'super-http';

afterEach(() => {
  HttpClientFactory.clear(); // reset singletons between tests
});
```

---

## Custom timeout per request

```typescript
// Override the pool-level timeout for a specific slow endpoint
const { data } = await client.get('/reports/annual', { timeout: 120_000 });
```

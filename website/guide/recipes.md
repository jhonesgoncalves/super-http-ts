# Recipes

Common patterns for using super-http in production.

---

## Global singleton per service

```typescript
// lib/clients.ts
import { HttpClientFactory } from 'super-http'

export const paymentsApi = HttpClientFactory.create(
  'https://payments.internal',
  { headers: { 'X-Service': 'my-app' } },
  { maxSockets: 50, timeout: 10_000 }
)
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(3, 300)

export const catalogApi = HttpClientFactory.create(
  'https://catalog.internal',
  {},
  { maxSockets: 100, timeout: 5_000 }
).retry(2, 200)
```

```typescript
// Anywhere in your app — same pool, pre-warmed
import { paymentsApi } from './lib/clients'
const { data } = await paymentsApi.post('/charges', payload)
```

---

## Typed responses

```typescript
interface Product {
  id: number
  name: string
  price: number
}

const { data } = await client.get<Product[]>('/products')
//     ^ Product[] — fully typed
```

---

## Per-request headers

```typescript
const { data } = await client.get('/profile', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'X-Correlation-ID': requestId,
  },
})
```

---

## Retry only on rate-limiting

```typescript
// Retry up to 5 times when rate-limited (HTTP 429)
// with 2 s between attempts
client.retry(5, 2_000, [429])
```

---

## Graceful fallback on circuit open

```typescript
async function getRecommendations(userId: string) {
  try {
    const { data } = await recsClient.get(`/users/${userId}`)
    return data
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Circuit breaker is open') {
      return [] // degrade gracefully
    }
    throw err
  }
}
```

---

## Custom timeout per request

```typescript
// Override pool-level timeout for a slow report endpoint
const { data } = await client.get('/reports/annual', {
  timeout: 120_000,
})
```

---

## POST with query params

```typescript
const { data } = await client.post('/search', { query: 'foo' }, {
  params: { locale: 'pt-BR', page: 1 },
})
```

---

## Testing setup

```typescript
import { HttpClientFactory } from 'super-http'

afterEach(() => {
  HttpClientFactory.clear() // reset singleton between tests
})
```

---

## Aggressive CB for optional services

```typescript
// Fail fast — optional enrichment service
client.circuitBreak({
  failureThreshold: 2,
  successThreshold: 1,
  timeoutMs: 3_000,
})
```

## Conservative CB for critical dependencies

```typescript
// Require sustained recovery before closing
client.circuitBreak({
  failureThreshold: 10,
  successThreshold: 5,
  timeoutMs: 30_000,
})
```

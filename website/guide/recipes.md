# Recipes

Production-ready patterns for common distributed-systems scenarios.

---

## Global singleton per microservice

```typescript
// lib/clients.ts
import { HttpClientFactory, ExponentialJitterRetryStrategy } from 'super-http'

export const paymentsApi = HttpClientFactory.create(
  'https://payments.internal',
  { headers: { 'X-Service': 'my-app' } },
  { maxSockets: 100, timeout: 10_000 },
)
  .on({ onCircuitStateChange: ({ to }) => logger.warn(`payments circuit: ${to}`) })
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(3, new ExponentialJitterRetryStrategy(100, 5_000))
  .bulkhead({ maxConcurrent: 20, maxQueue: 50 })

export const catalogApi = HttpClientFactory.create('https://catalog.internal', {}, {
  maxSockets: 200, timeout: 3_000,
})
  .retry(2, new ExponentialJitterRetryStrategy(50, 2_000))
  .bulkhead({ maxConcurrent: 50, maxQueue: 200 })
  .dedup()
```

---

## Non-critical service with fast fallback

```typescript
const recommendations = HttpClientFactory.create('https://recs.internal')
  .circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 5_000 })
  .retry(1, new ExponentialJitterRetryStrategy(50, 500))
  .fallback(() => [])  // empty list — caller never sees an error
  .on({ onFallback: () => metrics.increment('recs.fallback') })

// Usage
const items = await recommendations.get<Item[]>('/items').then(r => r.data)
// Always returns an array, even when the service is down
```

---

## Rate-limited third-party API (Retry-After aware)

```typescript
import { RetryAfterStrategy } from 'super-http'

const stripe = HttpClientFactory.create('https://api.stripe.com', {
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
}, { timeout: 15_000 })
  .rateLimit({ permitLimit: 90, windowMs: 60_000 })  // Stripe: 100/min, keep 10% headroom
  .retry(5, new RetryAfterStrategy())                  // respects Retry-After on 429
  .circuitBreak({ failureThreshold: 10, successThreshold: 3, timeoutMs: 30_000 })
```

---

## High-throughput read service with dedup + bulkhead

```typescript
const usersApi = HttpClientFactory.create('https://users.internal', {}, {
  maxSockets: 200,
  timeout: 5_000,
})
  .bulkhead({ maxConcurrent: 100, maxQueue: 500, queueTimeoutMs: 2_000 })
  .retry(2, new ExponentialJitterRetryStrategy(50, 1_000))
  .dedup()  // multiple callers fetching same user → 1 network call

// e.g. in a server-rendered page that has 20 components fetching /users/me
const { data: me } = await usersApi.get('/users/me')
```

---

## Full observability wired to Prometheus

```typescript
const api = HttpClientFactory.create('https://api.example.com')

api.on({
  onRetry: ({ attempt, delayMs }) => {
    retryCounter.labels({ attempt: String(attempt) }).inc()
    retryDelayHistogram.observe(delayMs / 1000)
  },
  onCircuitStateChange: ({ from, to, failures }) => {
    circuitGauge.labels({ state: to }).set(1)
    circuitGauge.labels({ state: from }).set(0)
    if (to === 'open') circuitOpenTotal.inc({ failures: String(failures) })
  },
  onBulkheadReject:  () => bulkheadRejectedTotal.inc(),
  onFallback:        () => fallbackTotal.inc(),
  onRateLimitReject: () => rateLimitRejectedTotal.inc(),
})
```

---

## Per-request headers (auth tokens, correlation IDs)

```typescript
const { data } = await api.get('/profile', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'X-Correlation-ID': requestId,
    'X-Request-ID': crypto.randomUUID(),
  },
})
```

---

## Custom timeout per request

```typescript
// Override pool-level timeout for a known slow endpoint
const { data } = await api.get('/reports/annual', { timeout: 120_000 })
```

---

## Testing: reset singletons between tests

```typescript
import { HttpClientFactory } from 'super-http'

afterEach(() => HttpClientFactory.clear())
```

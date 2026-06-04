# Fallback

The fallback handler is the **last line of defence**. It is invoked after all other policies (retry, circuit breaker) have been exhausted, allowing your application to degrade gracefully instead of propagating errors to the caller.

---

## Basic usage

```typescript
// Return a static default value
client.fallback(() => ({ items: [], degraded: true }))
```

```typescript
// Use the original error in the fallback decision
client.fallback((error) => {
  console.error('All policies exhausted:', error)
  return { items: [], reason: 'service unavailable' }
})
```

---

## Async fallback

```typescript
// Call a secondary data source
client.fallback(async (error) => {
  const cached = await cache.get('items')
  if (cached) return cached
  throw error // re-throw if no fallback available
})
```

---

## Re-throwing

If the fallback can't provide a usable response, throw the original (or a custom) error:

```typescript
client.fallback((error) => {
  if (error instanceof Error && error.message === 'Circuit breaker is open') {
    return { items: [], degraded: true }
  }
  throw error // no fallback for other errors
})
```

---

## Combining with circuit breaker

The most common pattern — serve degraded content while the circuit is open:

```typescript
import { HttpClientFactory, ExponentialJitterRetryStrategy } from 'super-http'

const recommendations = HttpClientFactory.create('https://recs.internal')

recommendations
  .circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 10_000 })
  .retry(2, new ExponentialJitterRetryStrategy(100, 2_000))
  .fallback(() => [])  // empty recommendations while service is down
  .on({ onFallback: ({ error }) => logger.warn('recs degraded', error) })

// Callers always get an array — never an error
const items = await recommendations.get<Item[]>('/items').then(r => r.data)
```

---

## Observability

```typescript
client.on({
  onFallback: ({ error }) => {
    metrics.increment('fallback.triggered')
    logger.error('Fallback invoked', { error })
  },
})
```

::: warning
The fallback return value **replaces the entire `HttpClientResponse`**, not just `data`. Design your fallback to return a shape that your calling code can handle without type errors.
:::

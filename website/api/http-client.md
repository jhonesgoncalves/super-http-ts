# HttpClient

The core HTTP client. Wraps Axios with all resilience features.

Instantiate via [`HttpClientFactory.create()`](./http-client-factory).

---

## HTTP Methods

All methods return `Promise<HttpClientResponse<T>>`.

```typescript
get<T>(url, config?)
post<T>(url, data?, config?)
put<T>(url, data?, config?)
patch<T>(url, data?, config?)
delete<T>(url, config?)
request<T>(axiosConfig)
```

---

## Fluent configuration

All methods return `this` — chain as needed.

### `.on(events)`
Register observability hooks. See [ResilienceEvents](./resilience-events).

```typescript
client.on({
  onRetry:              ({ attempt, delayMs }) => logger.warn(`retry #${attempt}`),
  onCircuitStateChange: ({ from, to })         => metrics.gauge('circuit', to),
})
```

### `.retry(retries, strategy, retryOn?)`
```typescript
import { ExponentialJitterRetryStrategy } from 'super-http'

client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
client.retry(3, 500)               // fixed 500 ms (backwards-compat)
client.retry(3, 500, [429, 503])   // only these status codes
```

### `.circuitBreak(config)`
```typescript
client.circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
```

### `.bulkhead(config)`
```typescript
client.bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
```

### `.rateLimit(config)`
```typescript
client.rateLimit({ permitLimit: 200, windowMs: 60_000, queueRequests: true })
```

### `.fallback(fn)`
```typescript
client.fallback((error) => ({ items: [], degraded: true }))
client.fallback(async (error) => await cache.get('items') ?? [])
```

### `.dedup()`
```typescript
client.dedup()  // enables request deduplication
```

---

## Execution order

When multiple policies are active, they execute in this order:

```
dedup → rate-limiter → bulkhead → retry → circuit-breaker → axios → fallback
```

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
Register observability hooks. Handlers accumulate — two calls for the same hook
register both. See [ResilienceEvents](./resilience-events).

```typescript
client.on({
  onRetry:              ({ attempt, delayMs }) => logger.warn(`retry #${attempt}`),
  onCircuitStateChange: ({ from, to })         => metrics.gauge('circuit', to),
})
```

### `.retry(retries, strategy, options?)`
```typescript
import { ExponentialJitterRetryStrategy } from 'super-http'

client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
client.retry(3, 500)                                  // fixed 500 ms (backwards-compat)
client.retry(3, 500, [429, 503])                      // adds these statuses
client.retry(3, 500, { retryNonIdempotent: true })    // allow POST/PATCH retries
```

`retryOn` is **additive** to the network-error rules, not a replacement.
Ambiguous errors are retried only for idempotent methods unless
`retryNonIdempotent` is set — see
[what gets retried](../guide/retry#what-gets-retried).

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

### `.dedup(options?)`
```typescript
client.dedup()                                       // GET + HEAD
client.dedup({ methods: ['GET', 'HEAD', 'POST'] })   // opt in deliberately
```

### `.deadline(ms)`
Total budget for every request: queue waits, all attempts and all backoff combined.
See [Deadlines & Cancellation](../guide/deadlines).
```typescript
client.deadline(2_000)
```

### `.correlate(options?)`
Attaches a per-request id to every resilience event and sends it upstream.
```typescript
client.correlate()                            // x-request-id, uuid v4
client.correlate({ header: 'x-trace-id' })
```

---

## Inspection and lifecycle

### `.metrics()`
Cumulative counters — see [MetricsSnapshot](./metrics).

### `.state()`
What is true **right now**: circuit state (including per-policy breakers), bulkhead
active/queued, rate-limiter tokens and queue depth, dedup in-flight count.
Components that are not configured are omitted.
```typescript
if (client.state().circuit?.open) serveFromCache()
```

### `.resetMetrics()`
Zeroes every counter, the latency window and `uptime`.

### `.close()`
Destroys both agents' sockets and calls `uninstall()` on every plugin. Dropping the
reference is not enough — keep-alive sockets stay open until the remote or the OS
closes them.
```typescript
await client.close()
```

---

## Execution order

When multiple policies are active, they execute outermost-first in this order:

```
dedup → retry → bulkhead → rate-limiter → circuit-breaker → axios → fallback
```

Retry sits **outside** the bulkhead and the rate limiter, which has two
consequences worth knowing:

- A backoff sleep does **not** hold a bulkhead slot, so other callers are served
  while a failing request waits.
- Each attempt takes its own rate-limiter token, so `permitLimit` bounds what
  actually leaves the process, retries included.

A request rejected by the bulkhead or the rate limiter is not retried.

::: warning Changed in 2.0
Retry used to be the innermost policy. A request held its bulkhead slot through
every backoff sleep — effective concurrency collapsed with no socket in use — and
only the first attempt of a call ever took a token, so `permitLimit: 100` with
`retry(3)` could emit 400 requests.
:::

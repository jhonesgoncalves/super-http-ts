# API Reference

## Entry points

super-http has two factory APIs. Both return an `HttpClient` and share the same singleton cache per `baseURL`.

| API | Import | When to use |
|---|---|---|
| [`createClient`](./create-client) | `import { createClient }` | **Recommended** — single object, preset support |
| [`HttpClientFactory`](./http-client-factory) | `import { HttpClientFactory }` | Explicit three-arg signature, advanced use |

```typescript
// createClient — recommended
import { createClient } from 'super-http'
const api = createClient({ baseURL: 'https://api.example.com', preset: 'resilient-api' })

// HttpClientFactory — explicit
import { HttpClientFactory } from 'super-http'
const api = HttpClientFactory.create('https://api.example.com', httpConfig, poolConfig)
```

::: info Same cache
`createClient` is built on `HttpClientFactory`. Both share the same singleton cache — same `baseURL` always returns the same `HttpClient`. `HttpClientFactory.clear()` resets both.
:::

---

## All exports

```typescript
import {
  // ─── Entry points ──────────────────────────────────────────────────────────
  createClient,           // recommended factory with preset support
  HttpClientFactory,      // low-level singleton factory
  HttpClient,             // the HTTP client class

  // ─── Resilience ────────────────────────────────────────────────────────────
  CircuitBreaker,
  Bulkhead,
  RateLimiter,
  RequestDedup,

  // ─── Retry strategies ──────────────────────────────────────────────────────
  FixedRetryStrategy,
  ExponentialRetryStrategy,
  ExponentialJitterRetryStrategy,   // ← recommended
  RetryAfterStrategy,

  // ─── Plugins ───────────────────────────────────────────────────────────────
  LoggerPlugin,
  MetricsReporterPlugin,

  // ─── Types ─────────────────────────────────────────────────────────────────
  type Preset,
  type CreateClientOptions,
  type PoolConfig,
  type RequestPolicy,
  type CircuitBreakerConfig,
  type BulkheadConfig,
  type RateLimitConfig,
  type RetryStrategy,
  type SuperHttpPlugin,
  type ResilienceEvents,
  type MetricsSnapshot,
  type CircuitState,
  type HttpClientRequestConfig,
  type HttpClientResponse,
} from 'super-http'
```

---

## Navigation

| Export | Description |
|---|---|
| [`createClient`](./create-client) | Recommended factory — preset support, single options object |
| [`HttpClientFactory`](./http-client-factory) | Low-level factory — explicit three-arg signature, shared cache |
| [`HttpClient`](./http-client) | All methods, fluent config, metrics, plugins |
| [`CircuitBreaker`](./circuit-breaker) | Three-state circuit breaker |
| [`Bulkhead`](./bulkhead) | Concurrency limiter |
| [`RateLimiter`](./rate-limiter) | Token-bucket rate limiter |
| [`Retry Strategies`](./retry-strategy) | Fixed · Exponential · Jitter · RetryAfter |
| [`RequestDedup`](./request-dedup) | Request deduplication |
| [`ResilienceEvents`](./resilience-events) | All observability hook interfaces |
| [`MetricsSnapshot`](./metrics) | Built-in metrics interface |
| [`PoolConfig`](./pool-config) | Connection pool options |

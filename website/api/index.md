# API Reference

Complete reference for all public exports of `super-http`.

## Import

```typescript
import {
  // Core
  HttpClientFactory,
  HttpClient,

  // Resilience
  CircuitBreaker,
  Bulkhead,
  RateLimiter,
  RequestDedup,

  // Retry strategies
  FixedRetryStrategy,
  ExponentialRetryStrategy,
  ExponentialJitterRetryStrategy,
  RetryAfterStrategy,

  // Types
  type PoolConfig,
  type CircuitBreakerConfig,
  type BulkheadConfig,
  type RateLimitConfig,
  type RetryStrategy,
  type ResilienceEvents,
  type CircuitState,
  type HttpClientRequestConfig,
  type HttpClientResponse,
} from 'super-http'
```

## Navigation

| Export | Description |
|---|---|
| [`HttpClientFactory`](./http-client-factory) | Singleton factory — create and cache `HttpClient` instances |
| [`HttpClient`](./http-client) | The HTTP client — all methods and fluent config |
| [`CircuitBreaker`](./circuit-breaker) | Three-state circuit breaker |
| [`Bulkhead`](./bulkhead) | Concurrency limiter with bounded queue |
| [`RateLimiter`](./rate-limiter) | Token-bucket rate limiter |
| [`Retry Strategies`](./retry-strategy) | FixedRetry, Exponential, Jitter, RetryAfter |
| [`RequestDedup`](./request-dedup) | Request deduplication |
| [`ResilienceEvents`](./resilience-events) | Observability hook interfaces |
| [`PoolConfig`](./pool-config) | Connection pool options |

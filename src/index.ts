// Core
export { HttpClient, PoolConfig } from './http-client/http.client';
export { HttpClientFactory } from './http-client/http.factory';

// Circuit breaker
export { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker/circuit-break';

// Bulkhead
export { Bulkhead, BulkheadConfig } from './bulkhead/bulkhead';

// Rate limiter
export { RateLimiter, RateLimitConfig } from './rate-limiter/rate-limiter';

// Request deduplication
export { RequestDedup } from './dedup/request-dedup';

// Retry strategies
export {
  RetryStrategy,
  FixedRetryStrategy,
  ExponentialRetryStrategy,
  ExponentialJitterRetryStrategy,
  RetryAfterStrategy,
} from './models/retry.strategy';

// Events / observability
export {
  ResilienceEvents,
  RetryEvent,
  CircuitStateChangeEvent,
  CircuitState,
  BulkheadRejectEvent,
  FallbackEvent,
  RateLimitRejectEvent,
} from './models/resilience.events';

// Models
export { HttpClientRequestConfig } from './models/http.client.request.config';
export { HttpClientResponse } from './models/http.client.response';

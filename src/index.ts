// ─── Core ─────────────────────────────────────────────────────────────────────
export { HttpClient, PoolConfig, RequestPolicy } from './http-client/http.client';
export { HttpClientFactory } from './http-client/http.factory';

// ─── Factory + Presets ────────────────────────────────────────────────────────
export { createClient, CreateClientOptions, Preset } from './presets/index';

// ─── Circuit breaker ─────────────────────────────────────────────────────────
export { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker/circuit-break';

// ─── Bulkhead ────────────────────────────────────────────────────────────────
export { Bulkhead, BulkheadConfig } from './bulkhead/bulkhead';

// ─── Rate limiter ─────────────────────────────────────────────────────────────
export { RateLimiter, RateLimitConfig } from './rate-limiter/rate-limiter';

// ─── Request deduplication ───────────────────────────────────────────────────
export { RequestDedup } from './dedup/request-dedup';

// ─── Retry strategies ─────────────────────────────────────────────────────────
export {
  RetryStrategy,
  FixedRetryStrategy,
  ExponentialRetryStrategy,
  ExponentialJitterRetryStrategy,
  RetryAfterStrategy,
} from './models/retry.strategy';

// ─── Plugins ─────────────────────────────────────────────────────────────────
export { SuperHttpPlugin, LoggerPlugin, MetricsReporterPlugin } from './plugins/index';

// ─── Observability / events ───────────────────────────────────────────────────
export {
  ResilienceEvents,
  RetryEvent,
  CircuitStateChangeEvent,
  CircuitState,
  BulkheadRejectEvent,
  FallbackEvent,
  RateLimitRejectEvent,
} from './models/resilience.events';

// ─── Metrics ─────────────────────────────────────────────────────────────────
export { MetricsSnapshot } from './models/metrics';

// ─── Models ──────────────────────────────────────────────────────────────────
export { HttpClientRequestConfig } from './models/http.client.request.config';
export { HttpClientResponse } from './models/http.client.response';

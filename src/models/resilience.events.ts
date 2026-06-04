/**
 * Context passed to the `onRetry` hook.
 */
export interface RetryEvent {
  /** Zero-based attempt index (0 = first retry). */
  attempt: number;
  /** The error that triggered the retry. */
  error: unknown;
  /** Delay that will be waited before the next attempt (ms). */
  delayMs: number;
}

/** Circuit breaker states. */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Context passed to `onCircuitStateChange`.
 */
export interface CircuitStateChangeEvent {
  from: CircuitState;
  to: CircuitState;
  /** Total failures at the time of the transition. */
  failures: number;
}

/**
 * Context passed to `onBulkheadReject`.
 */
export interface BulkheadRejectEvent {
  /** Number of currently active requests at rejection time. */
  active: number;
  /** Number of requests waiting in the queue at rejection time. */
  queued: number;
}

/**
 * Context passed to `onFallback`.
 */
export interface FallbackEvent {
  /** The original error that triggered the fallback. */
  error: unknown;
}

/**
 * Context passed to `onRateLimitReject`.
 */
export interface RateLimitRejectEvent {
  /** Configured request limit for the window. */
  permitLimit: number;
  /** Window size in ms. */
  windowMs: number;
}

/**
 * Observability hooks fired at key resilience events.
 *
 * All handlers are **fire-and-forget** — errors thrown inside them are silently
 * swallowed so they never affect the request path.
 *
 * @example
 * ```ts
 * const client = HttpClientFactory.create('https://api.example.com');
 *
 * client.on({
 *   onRetry:              ({ attempt, delayMs }) => logger.warn(`retry #${attempt}, waiting ${delayMs} ms`),
 *   onCircuitStateChange: ({ from, to })         => metrics.increment(`circuit.${from}_to_${to}`),
 *   onBulkheadReject:     ({ active })            => metrics.increment('bulkhead.rejected'),
 *   onFallback:           ({ error })             => logger.error('fallback triggered', error),
 * });
 * ```
 */
export interface ResilienceEvents {
  /** Fired before each retry attempt. */
  onRetry?: (event: RetryEvent) => void;

  /** Fired whenever the circuit breaker transitions between states. */
  onCircuitStateChange?: (event: CircuitStateChangeEvent) => void;

  /** Fired when a request is rejected by the bulkhead. */
  onBulkheadReject?: (event: BulkheadRejectEvent) => void;

  /** Fired when the fallback handler is invoked. */
  onFallback?: (event: FallbackEvent) => void;

  /** Fired when a request is rejected by the rate limiter. */
  onRateLimitReject?: (event: RateLimitRejectEvent) => void;
}

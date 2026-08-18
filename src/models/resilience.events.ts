import type { AxiosRequestConfig, AxiosResponse } from 'axios';

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
  /**
   * Correlation id of the request this retry belongs to.
   *
   * Without it these events are anonymous: a retry log line cannot be tied back
   * to the request that produced it, which is exactly what you need during an
   * incident.
   */
  requestId?: string;
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
  /** Correlation id of the request this event belongs to. */
  requestId?: string;
}

/**
 * Context passed to `onFallback`.
 */
export interface FallbackEvent {
  /** The original error that triggered the fallback. */
  error: unknown;
  /** Correlation id of the request this event belongs to. */
  requestId?: string;
}

/**
 * Context passed to `onRateLimitReject`.
 */
export interface RateLimitRejectEvent {
  /** Configured request limit for the window. */
  permitLimit: number;
  /** Window size in ms. */
  windowMs: number;
  /** Correlation id of the request this event belongs to. */
  requestId?: string;
}

/**
 * Observability and lifecycle hooks.
 *
 * All handlers are **fire-and-forget** — errors thrown inside them are silently
 * swallowed and never affect the request path.
 *
 * @example
 * ```ts
 * client.on({
 *   onRequest:  (cfg)           => logger.debug(`→ ${cfg.method} ${cfg.url}`),
 *   onResponse: (res)           => logger.debug(`← ${res.status}`),
 *   onError:    (err)           => logger.error('request failed', err),
 *   onRetry:    ({ attempt })   => metrics.increment('retry', { attempt }),
 *   onCircuitStateChange: ({ from, to }) => metrics.gauge('circuit', to),
 * })
 * ```
 */
export interface ResilienceEvents {
  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Fired just before every HTTP request is sent (after all policies are applied).
   * Use for logging, tracing, or header injection.
   */
  onRequest?: (config: AxiosRequestConfig) => void;

  /**
   * Fired when a successful response is received.
   * Note: called before the response reaches the caller.
   */
  onResponse?: (response: AxiosResponse) => void;

  /**
   * Fired when a request ultimately fails (after retries, if configured).
   * Not fired for retried errors that eventually succeed.
   */
  onError?: (error: unknown) => void;

  // ─── Resilience ───────────────────────────────────────────────────────────

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

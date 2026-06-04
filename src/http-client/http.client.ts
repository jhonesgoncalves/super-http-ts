import http from 'http';
import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from '../circuit-breaker/circuit-break';
import { Bulkhead, BulkheadConfig } from '../bulkhead/bulkhead';
import { RateLimiter, RateLimitConfig } from '../rate-limiter/rate-limiter';
import { RequestDedup } from '../dedup/request-dedup';
import { RetryStrategy, FixedRetryStrategy } from '../models/retry.strategy';
import { ResilienceEvents } from '../models/resilience.events';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { HttpClientResponse } from '../models/http.client.response';

// ─── Internal config types ────────────────────────────────────────────────────

interface RetryConfig {
  retries: number;
  strategy: RetryStrategy;
  retryOn?: number[];
}

/**
 * Options for the underlying Node.js HTTP/HTTPS connection pool.
 *
 * @example
 * ```ts
 * const pool: PoolConfig = {
 *   maxSockets: 100,
 *   maxFreeSockets: 20,
 *   keepAlive: true,
 *   keepAliveMsecs: 2000,
 *   timeout: 15_000,
 * };
 * ```
 */
export interface PoolConfig {
  /** Max concurrent sockets per host. @defaultValue 50 */
  maxSockets?: number;
  /** Max idle keep-alive sockets per host. @defaultValue 10 */
  maxFreeSockets?: number;
  /** Enable TCP keep-alive. @defaultValue true */
  keepAlive?: boolean;
  /** Keep-alive probe interval (ms). @defaultValue 1000 */
  keepAliveMsecs?: number;
  /** Request timeout (ms). @defaultValue 30000 */
  timeout?: number;
}

// ─── Retryable error detection ────────────────────────────────────────────────

const RETRYABLE_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT',
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNABORTED',
]);

interface AxiosLikeError {
  code?: string;
  response?: { status?: number };
}

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const e = error as AxiosLikeError;
    if (e.code && RETRYABLE_CODES.has(e.code)) return true;
    if (typeof e.response?.status === 'number' && e.response.status >= 500) return true;
  }
  return false;
}

// ─── HttpClient ───────────────────────────────────────────────────────────────

/**
 * A resilient, production-grade HTTP client built on top of Axios.
 *
 * **Resilience features (all opt-in via fluent API):**
 * - Connection pooling with TCP keep-alive (always on)
 * - Smart retry with pluggable back-off strategies
 * - Three-state circuit breaker
 * - Bulkhead isolation (concurrency limiter)
 * - Token-bucket rate limiter
 * - Fallback / graceful degradation
 * - Request deduplication (idempotent calls)
 * - Observability hooks (retry, circuit state, bulkhead, fallback, rate-limit)
 *
 * Instantiate via {@link HttpClientFactory} for singleton-per-baseURL behaviour.
 *
 * @example
 * ```ts
 * const api = HttpClientFactory.create('https://api.example.com')
 *
 * api
 *   .on({ onRetry: ({ attempt }) => logger.warn(`retry #${attempt}`) })
 *   .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
 *   .retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
 *   .bulkhead({ maxConcurrent: 20, maxQueue: 100 })
 *   .rateLimit({ permitLimit: 200, windowMs: 60_000 })
 *
 * const { data } = await api.get<User[]>('/users')
 * ```
 */
export class HttpClient {
  private readonly axiosInstance: AxiosInstance;
  private retryConfig?: RetryConfig;
  private circuitBreakerConfig?: CircuitBreakerConfig;
  private circuitBreaker?: CircuitBreaker;
  private bulkheadInstance?: Bulkhead;
  private rateLimiterInstance?: RateLimiter;
  private dedupInstance?: RequestDedup;
  private fallbackFn?: (error: unknown) => unknown;
  private resilienceEvents: ResilienceEvents = {};

  constructor(
    baseURL: string,
    httpClientRequestConfig: HttpClientRequestConfig = {},
    circuitBreaker?: CircuitBreaker,
    poolConfig: PoolConfig = {},
  ) {
    this.circuitBreaker = circuitBreaker;

    const {
      maxSockets = 50,
      maxFreeSockets = 10,
      keepAlive = true,
      keepAliveMsecs = 1000,
      timeout,
    } = poolConfig;

    const httpAgent = new http.Agent({ maxSockets, maxFreeSockets, keepAlive, keepAliveMsecs });
    const httpsAgent = new https.Agent({ maxSockets, maxFreeSockets, keepAlive, keepAliveMsecs });

    this.axiosInstance = axios.create({
      ...httpClientRequestConfig,
      baseURL,
      timeout: timeout ?? httpClientRequestConfig.timeout ?? 30_000,
      httpAgent,
      httpsAgent,
    });
  }

  // ─── Observability ────────────────────────────────────────────────────────

  /**
   * Registers observability hooks fired at key resilience events.
   * Multiple calls merge the handlers (last write wins per key).
   *
   * @returns `this` — enables fluent chaining.
   *
   * @example
   * ```ts
   * client.on({
   *   onRetry:              ({ attempt, delayMs }) => logger.warn(`retry #${attempt} in ${delayMs} ms`),
   *   onCircuitStateChange: ({ from, to })         => metrics.increment(`circuit.${from}_${to}`),
   *   onBulkheadReject:     ()                     => metrics.increment('bulkhead.rejected'),
   * })
   * ```
   */
  on(events: ResilienceEvents): this {
    this.resilienceEvents = { ...this.resilienceEvents, ...events };
    return this;
  }

  // ─── Fluent resilience configuration ─────────────────────────────────────

  /**
   * Enables automatic retry with a pluggable back-off strategy.
   *
   * **Strategy shortcuts:**
   * - Pass a `number` for fixed delay (backwards-compatible).
   * - Pass a {@link RetryStrategy} for full control.
   *
   * @param retries  - Maximum retry attempts.
   * @param strategy - Delay strategy or fixed delay in ms.
   * @param retryOn  - Optional: retry only on these HTTP status codes.
   *
   * @example
   * ```ts
   * import { ExponentialJitterRetryStrategy } from 'super-http'
   *
   * client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
   * client.retry(3, 500)                     // fixed 500 ms (legacy)
   * client.retry(5, 1000, [429, 503])        // fixed, specific codes
   * ```
   */
  retry(retries: number, strategy: RetryStrategy | number, retryOn?: number[]): this {
    this.retryConfig = {
      retries,
      strategy: typeof strategy === 'number' ? new FixedRetryStrategy(strategy) : strategy,
      retryOn,
    };
    return this;
  }

  /**
   * Enables the three-state circuit breaker.
   *
   * @param config - Thresholds and timeout. See {@link CircuitBreakerConfig}.
   *
   * @example
   * ```ts
   * client.circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
   * ```
   */
  circuitBreak(config: CircuitBreakerConfig): this {
    this.circuitBreakerConfig = config;
    return this;
  }

  /**
   * Enables bulkhead isolation — limits the number of concurrent in-flight
   * requests and optionally queues excess calls.
   *
   * @param config - See {@link BulkheadConfig}.
   *
   * @example
   * ```ts
   * client.bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
   * ```
   */
  bulkhead(config: BulkheadConfig): this {
    this.bulkheadInstance = new Bulkhead(config, this.resilienceEvents);
    return this;
  }

  /**
   * Enables token-bucket rate limiting for outgoing requests.
   *
   * @param config - See {@link RateLimitConfig}.
   *
   * @example
   * ```ts
   * client.rateLimit({ permitLimit: 100, windowMs: 60_000 })
   * ```
   */
  rateLimit(config: RateLimitConfig): this {
    this.rateLimiterInstance = new RateLimiter(config, this.resilienceEvents);
    return this;
  }

  /**
   * Enables request deduplication for idempotent calls.
   *
   * When multiple concurrent callers request the same URL + method + params,
   * only one HTTP request is sent. All callers share the same result.
   *
   * **Only use for idempotent requests (GET, HEAD).**
   *
   * @example
   * ```ts
   * client.dedup()
   * const [a, b] = await Promise.all([client.get('/users/1'), client.get('/users/1')])
   * // → single network request
   * ```
   */
  dedup(): this {
    this.dedupInstance = new RequestDedup();
    return this;
  }

  /**
   * Registers a fallback handler invoked when the request fails after all
   * retry attempts and the circuit is open (or any unrecoverable error).
   *
   * The handler may return a value, throw a different error, or call an
   * alternative data source.
   *
   * @param fn - Receives the original error; must return the fallback value
   *   (typed as `T`) or throw.
   *
   * @example
   * ```ts
   * client.fallback(() => ({ items: [], fromFallback: true }))
   * ```
   */
  fallback<T>(fn: (error: unknown) => T | Promise<T>): this {
    this.fallbackFn = fn as (error: unknown) => unknown;
    return this;
  }

  // ─── HTTP convenience methods ─────────────────────────────────────────────

  /**
   * Sends an HTTP `GET` request.
   * @example `const { data } = await client.get<User[]>('/users')`
   */
  get<T = unknown>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'get' });
  }

  /**
   * Sends an HTTP `POST` request.
   * @example `const { data } = await client.post<User>('/users', { name: 'Alice' })`
   */
  post<T = unknown>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'post', data });
  }

  /**
   * Sends an HTTP `PUT` request.
   */
  put<T = unknown>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'put', data });
  }

  /**
   * Sends an HTTP `PATCH` request.
   */
  patch<T = unknown>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'patch', data });
  }

  /**
   * Sends an HTTP `DELETE` request.
   */
  delete<T = unknown>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'delete' });
  }

  /**
   * Sends a raw request using the full Axios request config.
   */
  request<T = unknown>(config: AxiosRequestConfig): Promise<HttpClientResponse<T>> {
    const dedupKey = this.dedupInstance
      ? `${config.method?.toUpperCase()}:${config.url}:${JSON.stringify(config.params ?? '')}`
      : undefined;

    const core = (): Promise<HttpClientResponse<T>> => {
      let fn: () => Promise<HttpClientResponse<T>> = () =>
        this.axiosInstance.request<T>(config);

      if (this.circuitBreakerConfig) fn = this.withCircuitBreaker(fn, this.circuitBreakerConfig);
      if (this.retryConfig) fn = this.withRetry(fn, this.retryConfig);
      if (this.bulkheadInstance) fn = this.withBulkhead(fn);
      if (this.rateLimiterInstance) fn = this.withRateLimit(fn);

      return fn();
    };

    const withFallback = this.fallbackFn
      ? () =>
          core().catch((err) => {
            this.safeCall(() =>
              this.resilienceEvents.onFallback?.({ error: err }),
            );
            return Promise.resolve(this.fallbackFn!(err)) as Promise<HttpClientResponse<T>>;
          })
      : core;

    if (this.dedupInstance && dedupKey) {
      return this.dedupInstance.execute(dedupKey, withFallback);
    }

    return withFallback();
  }

  // ─── Private decorators ───────────────────────────────────────────────────

  private withRetry<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    retryConfig: RetryConfig,
  ): () => Promise<HttpClientResponse<T>> {
    return async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await requestFn();
        } catch (error: unknown) {
          const isCircuitOpen =
            error instanceof Error && error.message === 'Circuit breaker is open';

          if (isCircuitOpen || attempt >= retryConfig.retries) throw error;

          const status = this.extractStatus(error);
          const shouldRetry = retryConfig.retryOn
            ? typeof status === 'number' && retryConfig.retryOn.includes(status)
            : isRetryableError(error);

          if (!shouldRetry) throw error;

          const delayMs = retryConfig.strategy.computeDelay(attempt, error);
          this.safeCall(() =>
            this.resilienceEvents.onRetry?.({ attempt, error, delayMs }),
          );
          await this.sleep(delayMs);
        }
      }
    };
  }

  private withCircuitBreaker<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    circuitBreakerConfig: CircuitBreakerConfig,
  ): () => Promise<HttpClientResponse<T>> {
    if (!this.circuitBreaker) this.circuitBreaker = new CircuitBreaker();
    this.circuitBreaker.setConfig(circuitBreakerConfig, this.resilienceEvents);
    const cb = this.circuitBreaker;
    return () => cb.execute(requestFn);
  }

  private withBulkhead<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
  ): () => Promise<HttpClientResponse<T>> {
    const bh = this.bulkheadInstance!;
    // Re-attach events (may have been registered after .bulkhead() call)
    return () => bh.execute(requestFn);
  }

  private withRateLimit<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
  ): () => Promise<HttpClientResponse<T>> {
    const rl = this.rateLimiterInstance!;
    return async () => {
      await rl.acquire();
      return requestFn();
    };
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private extractStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const e = error as Record<string, unknown>;
    const resp = e.response;
    if (!resp || typeof resp !== 'object') return undefined;
    const status = (resp as Record<string, unknown>).status;
    return typeof status === 'number' ? status : undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private safeCall(fn: () => void): void {
    try { fn(); } catch { /* never affect request path */ }
  }
}

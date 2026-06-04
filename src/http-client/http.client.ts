import http from 'http';
import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from '../circuit-breaker/circuit-break';
import { Bulkhead, BulkheadConfig } from '../bulkhead/bulkhead';
import { RateLimiter, RateLimitConfig } from '../rate-limiter/rate-limiter';
import { RequestDedup } from '../dedup/request-dedup';
import { RetryStrategy, FixedRetryStrategy } from '../models/retry.strategy';
import { ResilienceEvents } from '../models/resilience.events';
import { MetricsCollector, MetricsSnapshot } from '../models/metrics';
import { SuperHttpPlugin } from '../plugins/index';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { HttpClientResponse } from '../models/http.client.response';

// ─── Internal config types ────────────────────────────────────────────────────

interface RetryConfig {
  retries: number;
  strategy: RetryStrategy;
  retryOn?: number[];
}

/**
 * Per-request policy that overrides the client-level resilience config
 * for a single request.
 *
 * @example
 * ```ts
 * // Critical endpoint — tighter timeout and fewer retries
 * await client.get('/payments', {
 *   policy: { timeout: 1000, retry: { attempts: 1, delayMs: 100 } }
 * })
 *
 * // Non-critical — silent fallback
 * await client.get('/recommendations', {
 *   policy: { fallback: () => [] }
 * })
 * ```
 */
export interface RequestPolicy {
  /** Override the request timeout (ms) for this request only. */
  timeout?: number;
  /**
   * Override retry config for this request only.
   * Pass `false` to disable retry even if the client has one configured.
   */
  retry?: { attempts: number; delayMs?: number; retryOn?: number[] } | false;
  /**
   * Override circuit breaker for this request only.
   * Pass `false` to bypass the circuit breaker even if one is configured.
   */
  circuitBreaker?: Partial<CircuitBreakerConfig> | false;
  /**
   * Override fallback for this request only.
   * If set, this replaces the client-level fallback (if any).
   */
  fallback?: (error: unknown) => unknown;
}

/**
 * Options for the underlying Node.js HTTP/HTTPS connection pool.
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
 * Production-grade HTTP client for Node.js and TypeScript.
 *
 * **Built for production, not just requests.**
 *
 * Features (all opt-in via fluent API or presets):
 * - Connection pooling with TCP keep-alive
 * - Smart retry with pluggable back-off strategies
 * - Three-state circuit breaker
 * - Bulkhead isolation
 * - Token-bucket rate limiter
 * - Fallback / graceful degradation
 * - Request deduplication
 * - Observability hooks + built-in metrics
 * - Per-request policy overrides
 * - Plugin system
 *
 * @example
 * ```ts
 * import { createClient, ExponentialJitterRetryStrategy } from 'super-http'
 *
 * const api = createClient({ baseURL: 'https://api.example.com', preset: 'resilient-api' })
 *
 * api.on({ onRetry: ({ attempt }) => logger.warn(`retry #${attempt}`) })
 * api.use(LoggerPlugin())
 *
 * const { data } = await api.get<User[]>('/users')
 * const m = api.metrics() // { requests, success, p95Latency, … }
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
  private readonly _metrics = new MetricsCollector();
  private readonly _plugins = new Set<string>();

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

    // Wire lifecycle hooks (onRequest/onResponse/onError) into axios interceptors.
    // NOTE: metrics (request/success/failure) are tracked in the request() method
    // so they work correctly regardless of how the axios instance is mocked.
    this.axiosInstance.interceptors.request.use((config) => {
      this.safeCall(() => this.resilienceEvents.onRequest?.(config));
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.safeCall(() => this.resilienceEvents.onResponse?.(response));
        return response;
      },
      (error: unknown) => {
        this.safeCall(() => this.resilienceEvents.onError?.(error));
        return Promise.reject(error);
      },
    );
  }

  // ─── Observability ────────────────────────────────────────────────────────

  /**
   * Registers observability hooks. Multiple calls merge handlers (last wins per key).
   *
   * @example
   * ```ts
   * client.on({
   *   onRequest:  (cfg) => logger.debug(`→ ${cfg.method} ${cfg.url}`),
   *   onRetry:    ({ attempt, delayMs }) => metrics.inc('retry', { attempt }),
   *   onCircuitStateChange: ({ from, to }) => alerts.notify(`circuit ${from}→${to}`),
   * })
   * ```
   */
  on(events: ResilienceEvents): this {
    this.resilienceEvents = { ...this.resilienceEvents, ...events };
    return this;
  }

  /**
   * Returns a point-in-time snapshot of runtime metrics for this client.
   *
   * @example
   * ```ts
   * const m = client.metrics()
   * console.log(`p99=${m.p99Latency}ms  retries=${m.retries}  cbTrips=${m.circuitBreakerTrips}`)
   * ```
   */
  metrics(): MetricsSnapshot {
    return this._metrics.snapshot();
  }

  /**
   * Resets all accumulated metrics counters and latency history.
   */
  resetMetrics(): this {
    this._metrics.reset();
    return this;
  }

  /**
   * Installs a plugin. Each plugin is installed at most once (deduplicated by name).
   *
   * @example
   * ```ts
   * import { LoggerPlugin, MetricsReporterPlugin } from 'super-http'
   * client.use(LoggerPlugin({ prefix: '[payments]' }))
   * client.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
   * ```
   */
  use(plugin: SuperHttpPlugin): this {
    if (this._plugins.has(plugin.name)) return this;
    this._plugins.add(plugin.name);
    plugin.install(this);
    return this;
  }

  // ─── Fluent resilience configuration ─────────────────────────────────────

  /**
   * Enables automatic retry with a pluggable back-off strategy.
   *
   * @param retries  - Max retry attempts.
   * @param strategy - Delay strategy or fixed ms (backwards-compatible).
   * @param retryOn  - Optional: retry only on these HTTP status codes.
   *
   * @example
   * ```ts
   * client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
   * client.retry(3, 500)                   // fixed delay (legacy)
   * client.retry(3, 500, [429, 503])       // specific codes only
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
   * Enables bulkhead isolation — limits concurrent in-flight requests.
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
   * Enables token-bucket rate limiting.
   *
   * @example
   * ```ts
   * client.rateLimit({ permitLimit: 200, windowMs: 60_000 })
   * ```
   */
  rateLimit(config: RateLimitConfig): this {
    this.rateLimiterInstance = new RateLimiter(config, this.resilienceEvents);
    return this;
  }

  /**
   * Enables request deduplication for idempotent calls.
   *
   * @example
   * ```ts
   * client.dedup()
   * ```
   */
  dedup(): this {
    this.dedupInstance = new RequestDedup();
    return this;
  }

  /**
   * Registers a fallback handler invoked when all policies are exhausted.
   *
   * @example
   * ```ts
   * client.fallback((error) => ({ items: [], degraded: true }))
   * client.fallback(async () => cache.get('last-known-good'))
   * ```
   */
  fallback<T>(fn: (error: unknown) => T | Promise<T>): this {
    this.fallbackFn = fn as (error: unknown) => unknown;
    return this;
  }

  // ─── HTTP convenience methods ─────────────────────────────────────────────

  /** HTTP GET */
  get<T = unknown>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'get' });
  }

  /** HTTP POST */
  post<T = unknown>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'post', data });
  }

  /** HTTP PUT */
  put<T = unknown>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'put', data });
  }

  /** HTTP PATCH */
  patch<T = unknown>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'patch', data });
  }

  /** HTTP DELETE */
  delete<T = unknown>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'delete' });
  }

  /**
   * Sends a raw request. Accepts an optional `policy` field to override
   * client-level resilience config for this single request.
   *
   * @example
   * ```ts
   * // Tighter timeout + silent fallback for a non-critical endpoint
   * await client.request({
   *   url: '/recommendations',
   *   method: 'get',
   *   policy: { timeout: 500, retry: false, fallback: () => [] },
   * })
   * ```
   */
  request<T = unknown>(config: AxiosRequestConfig & { policy?: RequestPolicy }): Promise<HttpClientResponse<T>> {
    const { policy, ...axiosConfig } = config;

    // Apply per-request timeout override
    const requestConfig: AxiosRequestConfig = policy?.timeout
      ? { ...axiosConfig, timeout: policy.timeout }
      : axiosConfig;

    const dedupKey = this.dedupInstance
      ? `${requestConfig.method?.toUpperCase()}:${requestConfig.url}:${JSON.stringify(requestConfig.params ?? '')}`
      : undefined;

    const core = (): Promise<HttpClientResponse<T>> => {
      let fn: () => Promise<HttpClientResponse<T>> = () =>
        this.axiosInstance.request<T>(requestConfig);

      // Resolve effective circuit breaker config
      const effectiveCB = policy?.circuitBreaker === false
        ? undefined
        : policy?.circuitBreaker
          ? { ...(this.circuitBreakerConfig ?? { failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 }), ...policy.circuitBreaker }
          : this.circuitBreakerConfig;

      // Resolve effective retry config
      const effectiveRetry = policy?.retry === false
        ? undefined
        : policy?.retry
          ? { retries: policy.retry.attempts, strategy: new FixedRetryStrategy(policy.retry.delayMs ?? 100), retryOn: policy.retry.retryOn }
          : this.retryConfig;

      if (effectiveCB) fn = this.withCircuitBreaker(fn, effectiveCB);
      if (effectiveRetry) fn = this.withRetry(fn, effectiveRetry);
      if (this.bulkheadInstance) fn = this.withBulkhead(fn);
      if (this.rateLimiterInstance) fn = this.withRateLimit(fn);

      return fn();
    };

    // Resolve effective fallback
    const effectiveFallback = policy?.fallback !== undefined
      ? policy.fallback
      : this.fallbackFn;

    const withFallback = effectiveFallback
      ? () =>
          core().catch((err) => {
            this._metrics.recordFallback();
            this.safeCall(() => this.resilienceEvents.onFallback?.({ error: err }));
            return Promise.resolve(effectiveFallback(err)) as Promise<HttpClientResponse<T>>;
          })
      : core;

    const t0 = Date.now();
    this._metrics.recordRequest();

    const run = this.dedupInstance && dedupKey
      ? () => this.dedupInstance!.execute(dedupKey, withFallback)
      : withFallback;

    return run().then(
      (res) => { this._metrics.recordSuccess(Date.now() - t0); return res; },
      (err) => { this._metrics.recordFailure(); throw err; },
    );
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
          this._metrics.recordRetry();
          this.safeCall(() => this.resilienceEvents.onRetry?.({ attempt, error, delayMs }));
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
    this.circuitBreaker.setConfig(circuitBreakerConfig, {
      onCircuitStateChange: (evt) => {
        if (evt.to === 'open') this._metrics.recordCBTrip();
        this.safeCall(() => this.resilienceEvents.onCircuitStateChange?.(evt));
      },
    });
    const cb = this.circuitBreaker;
    return () => cb.execute(requestFn);
  }

  private withBulkhead<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
  ): () => Promise<HttpClientResponse<T>> {
    const bh = this.bulkheadInstance!;
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

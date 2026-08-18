import http from 'http';
import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from '../circuit-breaker/circuit-break';
import { Bulkhead, BulkheadConfig } from '../bulkhead/bulkhead';
import { RateLimiter, RateLimitConfig } from '../rate-limiter/rate-limiter';
import { RequestDedup, DedupOptions, DEFAULT_DEDUP_METHODS, buildDedupKey } from '../dedup/request-dedup';
import { RequestScope, createRequestScope, abortableSleep, isCancellation } from '../models/deadline';
import { assertDuration, assertIntAtLeast, assertOptional } from '../models/validate';
import { randomUUID } from 'crypto';
import { RetryStrategy, FixedRetryStrategy, ExponentialJitterRetryStrategy } from '../models/retry.strategy';
import { CircuitState, ResilienceEvents } from '../models/resilience.events';
import { MetricsCollector, MetricsSnapshot } from '../models/metrics';
import { SuperHttpPlugin } from '../plugins/index';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { HttpClientResponse } from '../models/http.client.response';

// ─── Internal config types ────────────────────────────────────────────────────

interface RetryConfig {
  retries: number;
  strategy: RetryStrategy;
  retryOn?: number[];
  retryNonIdempotent?: boolean;
}

/** Extra options for {@link HttpClient.retry}. */
export interface RetryOptions {
  /**
   * Additional HTTP status codes to retry on, **on top of** the network-error
   * rules — not instead of them.
   */
  retryOn?: number[];
  /**
   * Retry non-idempotent methods (`POST`, `PATCH`) even on errors where the
   * request may already have been applied upstream.
   *
   * Off by default: a timed-out `POST /payments` that gets re-sent can charge
   * twice. Turn this on only when the endpoint is protected by an idempotency
   * key.
   *
   * @defaultValue false
   */
  retryNonIdempotent?: boolean;
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
  retry?: { attempts: number; delayMs?: number; retryOn?: number[]; retryNonIdempotent?: boolean } | false;
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

  /**
   * Cancels the whole call — queue waits, retry backoff and the in-flight
   * request alike, not just the socket.
   */
  signal?: AbortSignal;

  /**
   * Upper bound (ms) on the **total** time this call may take: rate-limit wait
   * plus bulkhead wait plus every attempt plus every backoff.
   *
   * `timeout` bounds one attempt; this bounds the call. Without it a request
   * with retries and queueing has no limit the caller can state.
   */
  deadlineMs?: number;
}

/**
 * Live state of a client's resilience components — what is true *now*, as
 * opposed to the cumulative counters in {@link MetricsSnapshot}.
 *
 * `circuitBreakerTrips` tells you the circuit opened at some point; it cannot
 * answer "is it open right now?", which is the question a dashboard or an alert
 * actually asks.
 */
export interface ClientState {
  /** Client-level circuit, if one is configured. */
  circuit?: { state: CircuitState; open: boolean };
  /** Circuits created for per-request policy overrides, keyed by config. */
  policyCircuits: Record<string, { state: CircuitState; open: boolean }>;
  /** In-flight and queued counts, if a bulkhead is configured. */
  bulkhead?: { active: number; queued: number };
  /** Tokens left in the current window and queue depth, if configured. */
  rateLimit?: { available: number; queued: number };
  /** Number of in-flight coalesced requests, if dedup is enabled. */
  dedup?: { inFlight: number };
}

/** Options for correlation-id injection. */
export interface CorrelationOptions {
  /**
   * Header carrying the id.
   * @defaultValue 'x-request-id'
   */
  header?: string;
  /**
   * Generates the id.
   * @defaultValue `crypto.randomUUID()`
   */
  generate?: () => string;
}

/**
 * Options for the underlying Node.js HTTP/HTTPS connection pool.
 */
export interface PoolConfig {
  /**
   * Max concurrent sockets per host.
   *
   * Sized for burst headroom rather than average load: steady-state demand is
   * roughly `rps * latencySeconds`, so the default only starts to bind when
   * upstream latency degrades.
   *
   * @defaultValue 200
   */
  maxSockets?: number;
  /** Max idle keep-alive sockets per host. @defaultValue 50 */
  maxFreeSockets?: number;
  /** Enable TCP keep-alive. @defaultValue true */
  keepAlive?: boolean;
  /** Keep-alive probe interval (ms). @defaultValue 1000 */
  keepAliveMsecs?: number;
  /**
   * Response timeout (ms) — how long to wait for the upstream to answer a
   * request. This is the axios-level timeout; it does not bound how long a
   * socket may sit idle. See {@link PoolConfig.socketTimeoutMs}.
   *
   * @defaultValue 30000
   */
  timeout?: number;
  /**
   * Socket inactivity timeout (ms) applied to the agent itself.
   *
   * Without this, a connection that goes quiet — a NAT or firewall dropping a
   * half-open socket — is only noticed by the response timeout, and a socket
   * stuck in connect is bounded by nothing else. Node's `http.Agent` does not
   * expose a separate connect timeout, so this covers inactivity at any stage.
   *
   * Defaults to {@link PoolConfig.timeout}.
   */
  socketTimeoutMs?: number;
  /**
   * Max response body accepted, in bytes. Axios defaults to unlimited, so a
   * runaway upstream can exhaust the client's memory.
   *
   * @defaultValue 33554432 (32 MiB)
   */
  maxContentLength?: number;
  /**
   * Max request body sent, in bytes.
   * @defaultValue 33554432 (32 MiB)
   */
  maxBodyLength?: number;
}

// ─── Retryable error detection ────────────────────────────────────────────────

/**
 * Errors that prove the request never reached the server, so re-sending it
 * cannot duplicate a side effect. Safe to retry for any method.
 */
const CONNECT_FAILURE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

/**
 * Errors where the request may already have been received and applied. The
 * connection died, or timed out, *after* the bytes went out — so a retry can
 * duplicate the effect. Safe only for idempotent methods.
 */
const AMBIGUOUS_CODES = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNABORTED']);

/**
 * Methods that may be repeated without changing the result beyond the first
 * application (RFC 9110 §9.2.2).
 */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE']);

interface AxiosLikeError {
  code?: string;
  response?: { status?: number };
}

function isIdempotent(method: string | undefined): boolean {
  return IDEMPOTENT_METHODS.has((method ?? 'GET').toUpperCase());
}

/**
 * Decides whether `error` may be retried for a request using `method`.
 *
 * The rule is about what the error tells us, not only about whether it looks
 * transient: a connection refused proves nothing happened, while a timeout
 * proves nothing either way. The ambiguous case is gated on the method being
 * idempotent unless the caller explicitly opts in.
 */
function isRetryableError(error: unknown, method: string | undefined, retryNonIdempotent = false): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as AxiosLikeError;

  if (e.code && CONNECT_FAILURE_CODES.has(e.code)) return true;

  const ambiguous =
    (e.code !== undefined && AMBIGUOUS_CODES.has(e.code)) ||
    (typeof e.response?.status === 'number' && e.response.status >= 500);
  if (!ambiguous) return false;

  return retryNonIdempotent || isIdempotent(method);
}

/**
 * Rejections that mean "we are already at capacity", raised by the bulkhead and
 * the rate limiter rather than by the upstream.
 */
const LOAD_SHED_MESSAGES = new Set([
  'Bulkhead queue full',
  'Bulkhead queue timeout',
  'Rate limit exceeded',
  'Rate limit queue full',
  'Rate limit queue timeout',
]);

function isLoadShedError(error: unknown): boolean {
  return error instanceof Error && LOAD_SHED_MESSAGES.has(error.message);
}

/**
 * Default circuit-breaker failure predicate for HTTP.
 *
 * A `4xx` means the caller asked for something wrong — the integration point
 * answered correctly and is healthy, so counting it would let a burst of 404s
 * or 401s open the circuit and take down traffic that was working. `429` is
 * explicit backpressure, which the rate limiter and `Retry-After` handle;
 * opening the circuit is the wrong response to it.
 */
function httpCountsAsFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const status = (error as AxiosLikeError).response?.status;
  if (typeof status !== 'number') return true; // network error, timeout, reset
  return status >= 500;
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
  /**
   * Ceiling on distinct per-request circuit-breaker configs tracked. Policies
   * are normally constant literals, so a handful is realistic; the cap only
   * stops a caller that builds configs dynamically from growing the map.
   */
  private static readonly MAX_POLICY_BREAKERS = 64;

  /** Body-size ceiling applied to both directions unless overridden. */
  static readonly DEFAULT_MAX_BODY_BYTES = 32 * 1024 * 1024;

  private readonly axiosInstance: AxiosInstance;
  private readonly httpAgent: http.Agent;
  private readonly httpsAgent: https.Agent;
  private retryConfig?: RetryConfig;
  private circuitBreakerConfig?: CircuitBreakerConfig;
  private circuitBreaker?: CircuitBreaker;
  /** Breakers dedicated to per-request `policy.circuitBreaker` overrides, keyed by config. */
  private readonly policyBreakers = new Map<string, CircuitBreaker>();
  private bulkheadInstance?: Bulkhead;
  private rateLimiterInstance?: RateLimiter;
  private dedupInstance?: RequestDedup;
  private dedupMethods: ReadonlySet<string> = new Set(DEFAULT_DEDUP_METHODS);
  private fallbackFn?: (error: unknown) => unknown;
  private deadlineMs?: number;
  /** Per-attempt timeout the axios instance was built with, for budget clamping. */
  private readonly defaultTimeoutMs: number;
  private readonly eventHandlers = new Map<keyof ResilienceEvents, Array<(arg: never) => void>>();
  private correlation?: { header: string; generate: () => string };
  private readonly _metrics = new MetricsCollector();
  private readonly _plugins = new Set<string>();
  private readonly _pluginInstances: SuperHttpPlugin[] = [];

  constructor(
    baseURL: string,
    httpClientRequestConfig: HttpClientRequestConfig = {},
    circuitBreaker?: CircuitBreaker,
    poolConfig: PoolConfig = {},
  ) {
    this.circuitBreaker = circuitBreaker;

    const {
      maxSockets = 200,
      maxFreeSockets = 50,
      keepAlive = true,
      keepAliveMsecs = 1000,
      timeout,
      socketTimeoutMs,
      maxContentLength = HttpClient.DEFAULT_MAX_BODY_BYTES,
      maxBodyLength = HttpClient.DEFAULT_MAX_BODY_BYTES,
    } = poolConfig;

    // Node reads maxSockets: 0 as Infinity, so "zero sockets" would quietly mean
    // unlimited — the opposite of what the config says.
    assertIntAtLeast(maxSockets, 1, 'pool.maxSockets');
    assertIntAtLeast(maxFreeSockets, 0, 'pool.maxFreeSockets');
    assertOptional(timeout, (v) => assertDuration(v, 'pool.timeout'));
    assertOptional(socketTimeoutMs, (v) => assertDuration(v, 'pool.socketTimeoutMs'));
    assertIntAtLeast(maxContentLength, 1, 'pool.maxContentLength');
    assertIntAtLeast(maxBodyLength, 1, 'pool.maxBodyLength');

    this.defaultTimeoutMs = timeout ?? httpClientRequestConfig.timeout ?? 30_000;

    // The agent gets its own inactivity timeout. Previously `timeout` was read
    // out of poolConfig and used only for the axios response timeout, so nothing
    // ever bounded a socket that simply went quiet.
    const agentTimeout = socketTimeoutMs ?? this.defaultTimeoutMs;
    const agentOpts = { maxSockets, maxFreeSockets, keepAlive, keepAliveMsecs, timeout: agentTimeout };

    this.httpAgent = new http.Agent(agentOpts);
    this.httpsAgent = new https.Agent(agentOpts);

    this.axiosInstance = axios.create({
      // Defaults first so explicit user config still wins.
      maxContentLength,
      maxBodyLength,
      ...httpClientRequestConfig,
      baseURL,
      timeout: this.defaultTimeoutMs,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
    });

    // Wire lifecycle hooks (onRequest/onResponse/onError) into axios interceptors.
    // NOTE: metrics (request/success/failure) are tracked in the request() method
    // so they work correctly regardless of how the axios instance is mocked.
    this.axiosInstance.interceptors.request.use((config) => {
      this.emit('onRequest', config);
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.emit('onResponse', response);
        return response;
      },
      (error: unknown) => {
        this.emit('onError', error);
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
    // Additive, not last-wins. Overwriting made plugins non-composable: two
    // plugins observing onRetry meant only the second one ever ran.
    for (const [key, handler] of Object.entries(events)) {
      if (typeof handler !== 'function') continue;
      const name = key as keyof ResilienceEvents;
      const existing = this.eventHandlers.get(name) ?? [];
      existing.push(handler as (arg: never) => void);
      this.eventHandlers.set(name, existing);
    }
    return this;
  }

  /**
   * Invokes every handler registered for `name`. One throwing handler must
   * neither break the request nor stop the others.
   */
  private emit<K extends keyof ResilienceEvents>(name: K, arg: Parameters<NonNullable<ResilienceEvents[K]>>[0]): void {
    const handlers = this.eventHandlers.get(name);
    if (!handlers) return;
    for (const handler of handlers) {
      this.safeCall(() => (handler as (a: typeof arg) => void)(arg));
    }
  }

  /**
   * Enables correlation-id injection.
   *
   * Each request gets an id, sent in a header (unless the caller already set
   * one) and attached to every resilience event, so a retry or a circuit trip
   * can be traced back to the request that caused it.
   *
   * @example
   * ```ts
   * client.correlate()                              // x-request-id, uuid
   * client.correlate({ header: 'x-trace-id' })
   * ```
   */
  correlate(options: CorrelationOptions = {}): this {
    this.correlation = {
      header: (options.header ?? 'x-request-id').toLowerCase(),
      generate: options.generate ?? (() => randomUUID()),
    };
    return this;
  }

  /**
   * Returns the **current** state of every configured resilience component.
   *
   * @example
   * ```ts
   * if (client.state().circuit?.open) skipTheCall()
   * ```
   */
  state(): ClientState {
    const snap = (cb: CircuitBreaker): { state: CircuitState; open: boolean } => ({
      state: cb.state,
      open: cb.isOpen,
    });

    const policyCircuits: Record<string, { state: CircuitState; open: boolean }> = {};
    for (const [key, cb] of this.policyBreakers) policyCircuits[key] = snap(cb);

    return {
      circuit: this.circuitBreaker && this.circuitBreaker.isConfigured ? snap(this.circuitBreaker) : undefined,
      policyCircuits,
      bulkhead: this.bulkheadInstance
        ? { active: this.bulkheadInstance.activeCount, queued: this.bulkheadInstance.queuedCount }
        : undefined,
      rateLimit: this.rateLimiterInstance
        ? { available: this.rateLimiterInstance.available, queued: this.rateLimiterInstance.queuedCount }
        : undefined,
      dedup: this.dedupInstance ? { inFlight: this.dedupInstance.size } : undefined,
    };
  }

  /**
   * Releases everything this client owns: keep-alive sockets on both agents and
   * any plugin timers.
   *
   * Dropping the reference is not enough — the agents keep their sockets open
   * until the remote or the OS closes them, which is why
   * `HttpClientFactory.clear()` used to leak a socket per cached client.
   */
  async close(): Promise<void> {
    for (const plugin of this._pluginInstances) {
      this.safeCall(() => plugin.uninstall?.(this));
    }
    this._pluginInstances.length = 0;
    this._plugins.clear();
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
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
    this._pluginInstances.push(plugin);
    plugin.install(this);
    return this;
  }

  // ─── Fluent resilience configuration ─────────────────────────────────────

  /**
   * Enables automatic retry with a pluggable back-off strategy.
   *
   * Ambiguous errors — where the request may already have been applied upstream —
   * are retried only for idempotent methods unless `retryNonIdempotent` is set.
   *
   * @param retries  - Max retry attempts.
   * @param strategy - Delay strategy or fixed ms (backwards-compatible).
   * @param options  - Status codes to add, or a {@link RetryOptions} object.
   *
   * @example
   * ```ts
   * client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
   * client.retry(3, 500)                   // fixed delay (legacy)
   * client.retry(3, 500, [429, 503])       // also retry these statuses
   * client.retry(3, 500, { retryNonIdempotent: true })  // allow POST retries
   * ```
   */
  retry(retries: number, strategy: RetryStrategy | number, options?: number[] | RetryOptions): this {
    assertIntAtLeast(retries, 0, 'retry.retries');
    if (typeof strategy === 'number') assertDuration(strategy, 'retry.delayMs');
    const opts: RetryOptions = Array.isArray(options) ? { retryOn: options } : options ?? {};
    this.retryConfig = {
      retries,
      strategy: typeof strategy === 'number' ? new FixedRetryStrategy(strategy) : strategy,
      retryOn: opts.retryOn,
      retryNonIdempotent: opts.retryNonIdempotent,
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
    // 4xx answers come from a healthy upstream; only count real faults unless
    // the caller supplied their own predicate.
    this.circuitBreakerConfig = { shouldTrip: httpCountsAsFailure, ...config };
    if (!this.circuitBreaker) this.circuitBreaker = new CircuitBreaker();
    this.circuitBreaker.setConfig(this.circuitBreakerConfig, this.circuitBreakerHooks());
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
    this.bulkheadInstance = new Bulkhead(config, { onBulkheadReject: (e) => this.emit('onBulkheadReject', e) });
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
    this.rateLimiterInstance = new RateLimiter(config, { onRateLimitReject: (e) => this.emit('onRateLimitReject', e) });
    return this;
  }

  /**
   * Sets a total time budget (ms) for every request: queue waits, all attempts
   * and all backoff sleeps combined.
   *
   * A slow response costs the caller more than a fast failure — it holds their
   * resources while they wait — so a call needs a bound the caller chooses, not
   * the sum of whatever each layer happens to allow.
   *
   * @example
   * ```ts
   * client.deadline(2_000) // nothing takes longer than 2 s, retries included
   * ```
   */
  deadline(ms: number): this {
    assertIntAtLeast(ms, 1, 'deadline');
    this.deadlineMs = ms;
    return this;
  }

  /**
   * Enables request deduplication for idempotent calls.
   *
   * Only `GET` and `HEAD` are coalesced by default, and the request body is
   * part of the key — two concurrent writes with different payloads are never
   * collapsed into one.
   *
   * @example
   * ```ts
   * client.dedup()
   * client.dedup({ methods: ['GET', 'HEAD', 'POST'] })  // opt in, at your risk
   * ```
   */
  dedup(options?: DedupOptions): this {
    this.dedupInstance = new RequestDedup();
    this.dedupMethods = new Set((options?.methods ?? DEFAULT_DEDUP_METHODS).map((m) => m.toUpperCase()));
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

    // One scope per call: the caller's cancellation and the total deadline folded
    // into a single signal, plus the remaining budget every layer clamps against.
    const scope = createRequestScope({
      signal: policy?.signal ?? (axiosConfig.signal as AbortSignal | undefined),
      deadlineMs: policy?.deadlineMs ?? this.deadlineMs,
    });

    // One id per logical request, reused across attempts so retries of the same
    // call correlate to each other, not to N separate ids.
    const requestId = this.correlation?.generate();
    if (requestId && this.correlation) {
      const header = this.correlation.header;
      const headers = { ...(axiosConfig.headers ?? {}) } as Record<string, unknown>;
      const alreadySet = Object.keys(headers).some((k) => k.toLowerCase() === header);
      if (!alreadySet) headers[header] = requestId;
      axiosConfig.headers = headers as typeof axiosConfig.headers;
    }

    const perAttemptTimeout = policy?.timeout ?? this.defaultTimeoutMs;

    // Recomputed per attempt: an attempt must never outlive the total budget, and
    // the budget shrinks as earlier attempts and backoffs consume it.
    const attemptConfig = (): AxiosRequestConfig => {
      const left = scope.remaining();
      return {
        ...axiosConfig,
        timeout: Number.isFinite(left) ? Math.max(1, Math.min(perAttemptTimeout, left)) : perAttemptTimeout,
        signal: scope.signal ?? (axiosConfig.signal as AbortSignal | undefined),
      };
    };

    const requestConfig: AxiosRequestConfig = policy?.timeout
      ? { ...axiosConfig, timeout: policy.timeout }
      : axiosConfig;

    const dedupKey = this.dedupInstance
      ? buildDedupKey({
          method: requestConfig.method,
          url: requestConfig.url,
          params: requestConfig.params,
          data: requestConfig.data,
          methods: this.dedupMethods,
        })
      : undefined;

    const core = (): Promise<HttpClientResponse<T>> => {
      let fn: () => Promise<HttpClientResponse<T>> = () => this.axiosInstance.request<T>(attemptConfig());

      // Resolve effective circuit breaker config
      const effectiveCB =
        policy?.circuitBreaker === false
          ? undefined
          : policy?.circuitBreaker
          ? {
              shouldTrip: httpCountsAsFailure,
              ...(this.circuitBreakerConfig ?? { failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 }),
              ...policy.circuitBreaker,
            }
          : this.circuitBreakerConfig;

      // Resolve effective retry config
      const effectiveRetry =
        policy?.retry === false
          ? undefined
          : policy?.retry
          ? {
              retries: policy.retry.attempts,
              // An explicit delayMs means a fixed delay; otherwise inherit the
              // client's strategy. Hard-coding a fixed 100 ms here silently threw
              // away a configured jitter strategy and turned every per-request
              // override into a thundering herd.
              strategy:
                policy.retry.delayMs !== undefined
                  ? new FixedRetryStrategy(policy.retry.delayMs)
                  : this.retryConfig?.strategy ?? new ExponentialJitterRetryStrategy(100, 10_000),
              retryOn: policy.retry.retryOn,
              retryNonIdempotent: policy.retry.retryNonIdempotent,
            }
          : this.retryConfig;

      // Order matters, innermost first: axios ← circuit breaker ← rate limiter ←
      // bulkhead ← retry.
      //
      // Retry sits OUTSIDE the bulkhead and the rate limiter so a request does
      // not hold a concurrency slot or a spent token while it sleeps through
      // backoff. Previously retry was innermost, so an upstream returning 500s
      // parked every bulkhead slot inside setTimeout — effective concurrency
      // collapsed with no socket in use — and only the first attempt of a call
      // ever took a token, letting `permitLimit: 100` emit 400 requests.
      if (effectiveCB) fn = this.withCircuitBreaker(fn, effectiveCB);
      if (this.rateLimiterInstance) fn = this.withRateLimit(fn, scope);
      if (this.bulkheadInstance) fn = this.withBulkhead(fn, scope);
      if (effectiveRetry) fn = this.withRetry(fn, effectiveRetry, requestConfig.method, scope, requestId);

      return fn();
    };

    // Resolve effective fallback
    const effectiveFallback = policy?.fallback !== undefined ? policy.fallback : this.fallbackFn;

    const withFallback = effectiveFallback
      ? () =>
          core().catch((err) => {
            this._metrics.recordFallback();
            this.emit('onFallback', { error: err, requestId });
            return Promise.resolve(effectiveFallback(err)) as Promise<HttpClientResponse<T>>;
          })
      : core;

    const t0 = Date.now();
    this._metrics.recordRequest();

    const run =
      this.dedupInstance && dedupKey ? () => this.dedupInstance!.execute(dedupKey, withFallback) : withFallback;

    return run()
      .then(
        (res) => {
          this._metrics.recordSuccess(Date.now() - t0);
          return res;
        },
        (err) => {
          this._metrics.recordFailure();
          throw err;
        },
      )
      .finally(() => scope.dispose());
  }

  // ─── Private decorators ───────────────────────────────────────────────────

  private withRetry<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    retryConfig: RetryConfig,
    method: string | undefined,
    scope: RequestScope,
    requestId?: string,
  ): () => Promise<HttpClientResponse<T>> {
    return async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await requestFn();
        } catch (error: unknown) {
          const isCircuitOpen = error instanceof Error && error.message === 'Circuit breaker is open';

          // The caller gave up, or the budget is gone: retrying would keep work
          // alive that nobody is waiting for any more.
          if (isCancellation(error)) throw error;

          // Backpressure is an answer, not a fault. Retrying a shed request just
          // re-queues it, which is the load the bulkhead and limiter exist to
          // refuse — and with retry now outermost it would loop.
          if (isLoadShedError(error)) throw error;

          if (isCircuitOpen || attempt >= retryConfig.retries) throw error;

          // retryOn *adds* statuses to the network-error rules. Treating it as a
          // replacement silently disabled ECONNRESET retries for anyone who
          // listed a status code.
          const status = this.extractStatus(error);
          const inRetryOnList =
            retryConfig.retryOn !== undefined && typeof status === 'number' && retryConfig.retryOn.includes(status);
          const shouldRetry =
            (inRetryOnList && (retryConfig.retryNonIdempotent || isIdempotent(method))) ||
            isRetryableError(error, method, retryConfig.retryNonIdempotent);

          if (!shouldRetry) throw error;

          const delayMs = retryConfig.strategy.computeDelay(attempt, error);

          // Sleeping past the deadline only to fail afterwards wastes the
          // caller's remaining budget — fail now, with the error that caused it.
          if (delayMs >= scope.remaining()) throw error;

          this._metrics.recordRetry();
          this.emit('onRetry', { attempt, error, delayMs, requestId });
          await abortableSleep(delayMs, scope.signal);
        }
      }
    };
  }

  private withCircuitBreaker<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    circuitBreakerConfig: CircuitBreakerConfig,
  ): () => Promise<HttpClientResponse<T>> {
    const cb = this.resolveCircuitBreaker(circuitBreakerConfig);
    return () => cb.execute(requestFn);
  }

  /**
   * Returns the breaker that owns `config`.
   *
   * A breaker carries state (failure streak, open/closed) as well as
   * thresholds, so requests configured differently must not share one:
   * reconfiguring a single shared instance per request let one
   * `policy.circuitBreaker` override rewrite the whole client's thresholds and
   * pool its failures with everyone else's.
   */
  private resolveCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    const clientConfig = this.circuitBreakerConfig;
    const matchesClient =
      clientConfig !== undefined &&
      config.failureThreshold === clientConfig.failureThreshold &&
      config.successThreshold === clientConfig.successThreshold &&
      config.timeoutMs === clientConfig.timeoutMs;

    if (matchesClient) return this.clientCircuitBreaker(config);

    const key = `${config.failureThreshold}:${config.successThreshold}:${config.timeoutMs}`;
    const existing = this.policyBreakers.get(key);
    if (existing) return existing;

    if (this.policyBreakers.size >= HttpClient.MAX_POLICY_BREAKERS) return this.clientCircuitBreaker(config);

    const breaker = new CircuitBreaker();
    breaker.setConfig(config, this.circuitBreakerHooks());
    this.policyBreakers.set(key, breaker);
    return breaker;
  }

  /** The client-wide breaker, configured on first use if `circuitBreak()` never ran. */
  private clientCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreaker) this.circuitBreaker = new CircuitBreaker();
    if (!this.circuitBreaker.isConfigured) this.circuitBreaker.setConfig(config, this.circuitBreakerHooks());
    return this.circuitBreaker;
  }

  /**
   * Observability hooks handed to every breaker. Resolves handlers
   * lazily, so `on()` may be called before or after `circuitBreak()`.
   */
  private circuitBreakerHooks(): Pick<ResilienceEvents, 'onCircuitStateChange'> {
    return {
      onCircuitStateChange: (evt) => {
        if (evt.to === 'open') this._metrics.recordCBTrip();
        this.emit('onCircuitStateChange', evt);
      },
    };
  }

  private withBulkhead<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    scope: RequestScope,
  ): () => Promise<HttpClientResponse<T>> {
    const bh = this.bulkheadInstance!;
    return async () => {
      try {
        return await bh.execute(requestFn, { signal: scope.signal, maxWaitMs: scope.remaining() });
      } catch (err) {
        const isBulkheadReject =
          err instanceof Error && (err.message === 'Bulkhead queue full' || err.message === 'Bulkhead queue timeout');
        if (isBulkheadReject) this._metrics.recordBHReject();
        throw err;
      }
    };
  }

  private withRateLimit<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    scope: RequestScope,
  ): () => Promise<HttpClientResponse<T>> {
    const rl = this.rateLimiterInstance!;
    return async () => {
      try {
        await rl.acquire({ signal: scope.signal, maxWaitMs: scope.remaining() });
      } catch (err) {
        this._metrics.recordRLReject();
        throw err;
      }
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
    try {
      fn();
    } catch {
      /* never affect request path */
    }
  }
}

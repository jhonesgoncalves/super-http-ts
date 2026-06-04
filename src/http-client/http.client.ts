import http from 'http';
import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from '../circuit-breaker/circuit-break';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { HttpClientResponse } from '../models/http.client.response';

/**
 * Configuration for the automatic retry behaviour.
 * @internal
 */
interface RetryConfig {
  retries: number;
  delayMs: number;
  retryOn?: number[];
}

/**
 * Options for the underlying Node.js HTTP/HTTPS connection pool.
 *
 * These values are passed directly to `http.Agent` and `https.Agent`.
 * Tuning the pool allows you to balance throughput against resource usage
 * for your specific workload.
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
  /**
   * Maximum number of concurrent open sockets per host.
   * @defaultValue 50
   */
  maxSockets?: number;

  /**
   * Maximum number of idle (keep-alive) sockets to keep open per host.
   * @defaultValue 10
   */
  maxFreeSockets?: number;

  /**
   * Enable TCP keep-alive on sockets.  Prevents `ECONNRESET` errors that
   * occur when a server closes an idle persistent connection.
   * @defaultValue true
   */
  keepAlive?: boolean;

  /**
   * Delay between keep-alive probes in milliseconds.
   * @defaultValue 1000
   */
  keepAliveMsecs?: number;

  /**
   * Global request timeout in milliseconds.  Overrides the value in
   * {@link HttpClientRequestConfig} when both are set.
   * @defaultValue 30000
   */
  timeout?: number;
}

/**
 * Network error codes that are considered safe to retry because they are
 * transient and not caused by the request payload itself.
 */
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNABORTED',
]);

/**
 * Returns `true` when an error is safe to retry.
 *
 * Retryable conditions:
 * - Network-level errors (socket hung up, connection refused, DNS failure, …)
 * - HTTP 5xx responses (server-side transient failures)
 *
 * Non-retryable:
 * - HTTP 4xx (client errors — retrying won't help)
 * - Business logic errors
 */
function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const e = error as Record<string, any>;
    if (e.code && RETRYABLE_CODES.has(e.code)) return true;
    if (e.response?.status >= 500) return true;
  }
  return false;
}

/**
 * A resilient HTTP client that wraps Axios with:
 * - **Connection pooling** — shared `http.Agent`/`https.Agent` with keep-alive
 * - **Smart retry** — retries on network errors and 5xx, skips 4xx
 * - **Circuit breaker** — trips after N failures, recovers automatically
 *
 * Instantiate via {@link HttpClientFactory} to get singleton-per-baseURL
 * behaviour with automatic pool reuse. Use the constructor directly when
 * you need full control.
 *
 * @example
 * ```ts
 * // Factory (recommended)
 * const client = HttpClientFactory.create('https://api.example.com');
 * client.retry(3, 500).circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 });
 * const { data } = await client.get('/users');
 *
 * // Direct instantiation
 * const client = new HttpClient('https://api.example.com', {}, undefined, { maxSockets: 100 });
 * ```
 */
export class HttpClient {
  private readonly axiosInstance: AxiosInstance;
  private retryConfig?: RetryConfig;
  private circuitBreakerConfig?: CircuitBreakerConfig;
  private circuitBreaker?: CircuitBreaker;

  /**
   * Creates a new `HttpClient`.
   *
   * @param baseURL - The base URL prepended to every request path.
   * @param httpClientRequestConfig - Default Axios config applied to all requests.
   * @param circuitBreaker - An optional pre-configured {@link CircuitBreaker} instance.
   *   When omitted, one is created lazily the first time `.circuitBreak()` is called.
   * @param poolConfig - Connection pool options.  See {@link PoolConfig}.
   */
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

  // ─── Fluent configuration ────────────────────────────────────────────────────

  /**
   * Enables automatic retry for failed requests.
   *
   * By default, retries are triggered by network errors (`ECONNRESET`,
   * `ETIMEDOUT`, etc.) and HTTP 5xx responses.  Pass `retryOn` to restrict
   * retries to specific HTTP status codes instead.
   *
   * @param retries - Maximum number of retry attempts.
   * @param delayMs - Fixed delay between attempts in milliseconds.
   * @param retryOn - Optional list of HTTP status codes to retry on.
   *   When provided, network-level errors are **not** retried unless their
   *   status code appears in this list.
   * @returns `this` — enables fluent chaining.
   *
   * @example
   * ```ts
   * client.retry(3, 500);                // retry any network/5xx error
   * client.retry(3, 500, [429, 503]);    // retry only 429 and 503
   * ```
   */
  retry(retries: number, delayMs: number, retryOn?: number[]): this {
    this.retryConfig = { retries, delayMs, retryOn };
    return this;
  }

  /**
   * Enables the circuit breaker for this client.
   *
   * @param config - Circuit breaker thresholds and timeout. See {@link CircuitBreakerConfig}.
   * @returns `this` — enables fluent chaining.
   *
   * @example
   * ```ts
   * client.circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 });
   * ```
   */
  circuitBreak(config: CircuitBreakerConfig): this {
    this.circuitBreakerConfig = config;
    return this;
  }

  // ─── HTTP convenience methods ─────────────────────────────────────────────────

  /**
   * Sends an HTTP `GET` request.
   *
   * @typeParam T - Expected response body type.
   * @param url - Request path (appended to `baseURL`).
   * @param config - Optional per-request Axios config.
   *
   * @example
   * ```ts
   * const { data } = await client.get<User[]>('/users');
   * ```
   */
  get<T = any>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'get' });
  }

  /**
   * Sends an HTTP `POST` request.
   *
   * @typeParam T - Expected response body type.
   * @param url - Request path (appended to `baseURL`).
   * @param data - Request body.
   * @param config - Optional per-request Axios config.
   *
   * @example
   * ```ts
   * const { data } = await client.post<User>('/users', { name: 'Alice' });
   * ```
   */
  post<T = any>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'post', data });
  }

  /**
   * Sends an HTTP `PUT` request.
   *
   * @typeParam T - Expected response body type.
   * @param url - Request path (appended to `baseURL`).
   * @param data - Request body.
   * @param config - Optional per-request Axios config.
   */
  put<T = any>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'put', data });
  }

  /**
   * Sends an HTTP `PATCH` request.
   *
   * @typeParam T - Expected response body type.
   * @param url - Request path (appended to `baseURL`).
   * @param data - Partial request body.
   * @param config - Optional per-request Axios config.
   */
  patch<T = any>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'patch', data });
  }

  /**
   * Sends an HTTP `DELETE` request.
   *
   * @typeParam T - Expected response body type.
   * @param url - Request path (appended to `baseURL`).
   * @param config - Optional per-request Axios config.
   */
  delete<T = any>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'delete' });
  }

  /**
   * Sends a raw request using the full Axios request config.
   * Prefer the typed convenience methods (`get`, `post`, …) when possible.
   *
   * @typeParam T - Expected response body type.
   * @param config - Full Axios request configuration.
   */
  request<T = any>(config: AxiosRequestConfig): Promise<HttpClientResponse<T>> {
    let requestFn: () => Promise<HttpClientResponse<T>> = () => this.axiosInstance.request<T>(config);

    if (this.circuitBreakerConfig) {
      requestFn = this.withCircuitBreaker(requestFn, this.circuitBreakerConfig);
    }

    if (this.retryConfig) {
      requestFn = this.withRetry(requestFn, this.retryConfig);
    }

    return requestFn();
  }

  // ─── Private decorators ───────────────────────────────────────────────────────

  private withRetry<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    retryConfig: RetryConfig,
  ): () => Promise<HttpClientResponse<T>> {
    return async () => {
      let attempt = 0;
      let lastError: unknown;

      do {
        try {
          return await requestFn();
        } catch (error: unknown) {
          lastError = error;
          const isCircuitOpen =
            error instanceof Error && error.message === 'Circuit breaker is open';

          if (isCircuitOpen || attempt >= retryConfig.retries) throw error;

          const axiosError = error as Record<string, unknown>;
          const status =
            axiosError.response && typeof axiosError.response === 'object'
              ? (axiosError.response as Record<string, unknown>).status
              : undefined;

          const shouldRetry = retryConfig.retryOn
            ? typeof status === 'number' && retryConfig.retryOn.includes(status)
            : isRetryableError(error);

          if (!shouldRetry) throw error;

          attempt++;
          await new Promise((resolve) => setTimeout(resolve, retryConfig.delayMs));
        }
      } while (attempt <= retryConfig.retries);

      throw lastError;
    };
  }

  private withCircuitBreaker<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    circuitBreakerConfig: CircuitBreakerConfig,
  ): () => Promise<HttpClientResponse<T>> {
    if (!this.circuitBreaker) this.circuitBreaker = new CircuitBreaker();
    this.circuitBreaker.setConfig(circuitBreakerConfig);
    const cb = this.circuitBreaker;
    return () => cb.execute(requestFn);
  }
}

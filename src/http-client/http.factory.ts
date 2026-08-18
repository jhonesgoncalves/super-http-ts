import { HttpClient, PoolConfig } from './http.client';
import { CircuitBreaker } from '../circuit-breaker/circuit-break';
import { HttpClientRequestConfig } from '../models/http.client.request.config';

/**
 * Factory that creates and caches {@link HttpClient} instances keyed by
 * `baseURL`.
 *
 * Sharing a single `HttpClient` per base URL means the underlying
 * connection pool (`http.Agent` / `https.Agent`) is reused across all
 * callers, avoiding unnecessary TCP handshakes and preventing
 * keep-alive socket leaks.
 *
 * @example
 * ```ts
 * // Both calls return the same HttpClient instance
 * const client = HttpClientFactory.create('https://api.example.com');
 * const same   = HttpClientFactory.create('https://api.example.com');
 * console.log(client === same); // true
 * ```
 */
export class HttpClientFactory {
  private static instances: Map<string, HttpClient> = new Map();

  /**
   * Returns the cached `HttpClient` for `baseURL`, or creates a new one.
   *
   * The first call for a given `baseURL` initialises a dedicated
   * {@link CircuitBreaker} and connection pool. Subsequent calls with the
   * same URL return the cached instance — `httpConfig` and `poolConfig` are
   * **ignored** on cache hits.
   *
   * @param baseURL - Base URL for all requests made by this client.
   * @param httpConfig - Default Axios request config (headers, auth, …).
   * @param poolConfig - Connection pool options. See {@link PoolConfig}.
   * @returns A configured {@link HttpClient}.
   *
   * @example
   * ```ts
   * const api = HttpClientFactory.create('https://api.example.com', {
   *   headers: { Authorization: `Bearer ${token}` },
   * }, {
   *   maxSockets: 100,
   *   timeout: 15_000,
   * });
   *
   * api.retry(3, 500).circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 });
   *
   * const { data } = await api.get('/users');
   * ```
   */
  static create(baseURL: string, httpConfig?: HttpClientRequestConfig, poolConfig?: PoolConfig): HttpClient {
    const existing = HttpClientFactory.instances.get(baseURL);
    if (existing) return existing;

    const circuitBreaker = new CircuitBreaker();
    const instance = new HttpClient(baseURL, httpConfig, circuitBreaker, poolConfig);
    HttpClientFactory.instances.set(baseURL, instance);

    return instance;
  }

  /**
   * Closes and removes all cached instances.
   *
   * Primarily useful in tests to ensure each test case starts with a fresh
   * client and pool. Each client is closed before being dropped: emptying the
   * map alone left every cached client's keep-alive sockets open, so the call
   * advertised for test isolation was leaking a pool per invocation.
   *
   * @example
   * ```ts
   * afterEach(() => HttpClientFactory.clear());
   * ```
   */
  static clear(): void {
    for (const instance of HttpClientFactory.instances.values()) {
      void instance.close().catch(() => undefined);
    }
    HttpClientFactory.instances.clear();
  }
}

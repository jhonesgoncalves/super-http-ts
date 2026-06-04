import { HttpClientFactory } from '../http-client/http.factory';
import { HttpClient, PoolConfig } from '../http-client/http.client';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { ExponentialJitterRetryStrategy } from '../models/retry.strategy';

/**
 * Built-in configuration presets.
 *
 * | Preset | Best for |
 * |---|---|
 * | `high-throughput` | Internal services, small payloads, max req/s |
 * | `resilient-api` | External APIs, payment gateways, critical paths |
 * | `low-latency` | Real-time features, sub-10ms p99 requirements |
 */
export type Preset = 'high-throughput' | 'resilient-api' | 'low-latency';

/**
 * Options for {@link createClient}.
 */
export interface CreateClientOptions extends HttpClientRequestConfig {
  /** Base URL prepended to every request. */
  baseURL: string;

  /**
   * Apply a built-in resilience preset.
   *
   * You can override any preset setting by passing additional options.
   * Individual calls to `.retry()`, `.circuitBreak()` etc. always take
   * precedence over the preset.
   */
  preset?: Preset;

  /** Connection pool options (merged with preset defaults when preset is set). */
  pool?: PoolConfig;
}

type PresetDefinition = {
  pool: PoolConfig;
  apply: (client: HttpClient) => void;
};

const PRESETS: Record<Preset, PresetDefinition> = {
  /**
   * Maximum throughput for internal services.
   * - Large connection pool (200 sockets)
   * - Tight timeout (5 s) to fail fast
   * - 1 retry with quick jitter (no thundering herd)
   * - No circuit breaker (internal services should always be up)
   */
  'high-throughput': {
    pool: { maxSockets: 200, maxFreeSockets: 50, keepAlive: true, keepAliveMsecs: 500, timeout: 5_000 },
    apply(client) {
      client.retry(1, new ExponentialJitterRetryStrategy(50, 500));
    },
  },

  /**
   * Full resilience for external or critical APIs.
   * - Circuit breaker (trip after 10 failures, recover after 10 s)
   * - Exponential jitter retry (3 attempts)
   * - Bulkhead (50 concurrent, 200 queued)
   * - Generous timeout (15 s)
   */
  'resilient-api': {
    pool: { maxSockets: 100, maxFreeSockets: 20, keepAlive: true, keepAliveMsecs: 1000, timeout: 15_000 },
    apply(client) {
      client
        .circuitBreak({ failureThreshold: 10, successThreshold: 3, timeoutMs: 10_000 })
        .retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
        .bulkhead({ maxConcurrent: 50, maxQueue: 200, queueTimeoutMs: 5_000 });
    },
  },

  /**
   * Minimum latency — pure throughput, no safety nets.
   * - Huge pool (500 sockets)
   * - Aggressive timeout (2 s)
   * - No retry, no circuit breaker
   * Use for real-time features where stale data is worse than no data.
   */
  'low-latency': {
    pool: { maxSockets: 500, maxFreeSockets: 100, keepAlive: true, keepAliveMsecs: 200, timeout: 2_000 },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    apply() {},
  },
};

/**
 * Creates a new `HttpClient` with optional preset configuration.
 *
 * Equivalent to `HttpClientFactory.create()` with the added convenience
 * of preset-based defaults. Individual calls to `.retry()`, `.circuitBreak()`,
 * etc. always override preset settings.
 *
 * @example
 * ```ts
 * // Resilient external API client
 * const payments = createClient({
 *   baseURL: 'https://payments.internal',
 *   preset: 'resilient-api',
 *   headers: { 'X-API-Key': process.env.PAYMENTS_KEY },
 * })
 *
 * // High-throughput internal service
 * const catalog = createClient({
 *   baseURL: 'https://catalog.internal',
 *   preset: 'high-throughput',
 *   pool: { maxSockets: 300 },  // override pool
 * })
 *
 * // No preset — manual config
 * const custom = createClient({ baseURL: 'https://api.example.com' })
 *   .retry(3, new ExponentialJitterRetryStrategy(100, 5_000))
 * ```
 */
export function createClient(options: CreateClientOptions): HttpClient {
  const { baseURL, preset, pool, ...httpConfig } = options;

  const presetDef = preset ? PRESETS[preset] : undefined;
  const mergedPool: PoolConfig = { ...(presetDef?.pool ?? {}), ...(pool ?? {}) };

  const client = HttpClientFactory.create(baseURL, httpConfig, mergedPool);

  if (presetDef) {
    presetDef.apply(client);
  }

  return client;
}

import { HttpClientFactory } from '../http-client/http.factory';
import { HttpClient, PoolConfig } from '../http-client/http.client';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { ExponentialJitterRetryStrategy } from '../models/retry.strategy';
import { assertIntAtLeast, assertOneOf } from '../models/validate';

/** HTTP resilience profiles. No preset is applied unless explicitly selected. */
export type Preset = 'high-throughput' | 'resilient-api' | 'low-latency';

/** Options for {@link createClient}. Also accepted by the NestJS module. */
export interface CreateClientOptions extends HttpClientRequestConfig {
  /** Independent client and resilience state, outside the shared URL registry. */
  isolated?: boolean;
  baseURL: string;
  /** Managed connection lifecycle, safe retry, deadline, circuit breaker and bulkhead. */
  preset?: Preset;
  /**
   * Preset concurrency budget per client/process (not requests per minute).
   * Derives pool size, idle reserve and bounded queue together. Requires a preset.
   * An explicit pool.maxSockets caps the effective concurrency budget.
   */
  capacity?: number;
  /** Total logical-call budget, including admission, retries and backoff. Must be >= 1 ms. */
  deadlineMs?: number;
  /** Advanced overrides, merged after preset defaults. Fluent methods override policies. */
  pool?: PoolConfig;
}

interface PresetDefinition {
  capacity: number;
  timeout: number;
  deadlineMs: number;
  retries: number;
  retryBaseMs: number;
  retryCapMs: number;
  queueTimeoutMs: number;
  circuitTimeoutMs: number;
}

const PRESETS: Record<Preset, PresetDefinition> = {
  'resilient-api': {
    capacity: 32,
    timeout: 1_500,
    deadlineMs: 3_000,
    retries: 1,
    retryBaseMs: 100,
    retryCapMs: 150,
    queueTimeoutMs: 200,
    circuitTimeoutMs: 5_000,
  },
  'high-throughput': {
    capacity: 128,
    timeout: 2_000,
    deadlineMs: 5_000,
    retries: 1,
    retryBaseMs: 50,
    retryCapMs: 100,
    queueTimeoutMs: 100,
    circuitTimeoutMs: 5_000,
  },
  'low-latency': {
    capacity: 32,
    timeout: 500,
    deadlineMs: 1_000,
    retries: 0,
    retryBaseMs: 0,
    retryCapMs: 0,
    queueTimeoutMs: 25,
    circuitTimeoutMs: 2_000,
  },
};

/**
 * Create an HTTP client with an optional managed resilience profile.
 *
 * Presets retire idle sockets, honour upstream keep-alive hints and bound every
 * logical call. Retries preserve method/body safety; ambiguous POST/PATCH errors
 * are not replayed. Circuit breakers use the client's HTTP failure classifier.
 * Capacity is local concurrency, not a distributed traffic limit or autoscaling.
 *
 * The shared factory remains first-configuration-wins. Use `isolated: true` for
 * independent policies against the same URL. Requests without a preset keep
 * their existing manual configuration behaviour.
 *
 * @example
 * ```ts
 * const members = createClient({
 *   baseURL: 'https://members.example',
 *   preset: 'resilient-api',
 *   isolated: true,
 * })
 * // Optional: scale all admission/pool limits using one budget.
 * const catalog = createClient({
 *   baseURL: 'https://catalog.example',
 *   preset: 'high-throughput',
 *   capacity: 64,
 *   deadlineMs: 2_000,
 * })
 * ```
 */
export function createClient(options: CreateClientOptions): HttpClient {
  const { baseURL, preset, pool, isolated = false, capacity, deadlineMs, ...httpConfig } = options;
  if (preset !== undefined) assertOneOf(preset, Object.keys(PRESETS), 'HTTP preset');
  if (capacity !== undefined) {
    assertIntAtLeast(capacity, 1, 'capacity');
    if (!preset) throw new RangeError('[super-http] capacity requires a preset');
  }
  if (deadlineMs !== undefined) assertIntAtLeast(deadlineMs, 1, 'deadlineMs');
  if (pool?.maxSockets !== undefined) assertIntAtLeast(pool.maxSockets, 1, 'pool.maxSockets');
  if (pool?.maxFreeSockets !== undefined) assertIntAtLeast(pool.maxFreeSockets, 0, 'pool.maxFreeSockets');

  const profile = preset ? PRESETS[preset] : undefined;
  const concurrent = profile ? Math.min(capacity ?? profile.capacity, pool?.maxSockets ?? Infinity) : 0;
  const mergedPool: PoolConfig = profile
    ? {
        keepAlive: true,
        scheduling: 'lifo',
        maxSockets: concurrent,
        maxFreeSockets: Math.max(1, Math.ceil(concurrent / 4)),
        freeSocketTimeoutMs: 4_000,
        keepAliveTimeoutBufferMs: 1_000,
        maxSocketAgeMs: 60_000,
        ...pool,
      }
    : { ...pool };
  if (profile) {
    // Keep the idle reserve coherent when an advanced override shrinks the pool.
    mergedPool.maxFreeSockets = Math.min(mergedPool.maxFreeSockets!, mergedPool.maxSockets!);
    httpConfig.timeout = httpConfig.timeout ?? profile.timeout;
  }

  const initialize = (client: HttpClient): void => {
    if (profile) {
      client
        .retry(profile.retries, new ExponentialJitterRetryStrategy(profile.retryBaseMs, profile.retryCapMs), {
          recoverReusedSocket: true,
          retryNonIdempotent: false,
        })
        .deadline(deadlineMs ?? profile.deadlineMs)
        .circuitBreak({ failureThreshold: 10, successThreshold: 1, timeoutMs: profile.circuitTimeoutMs })
        .bulkhead({ maxConcurrent: concurrent, maxQueue: concurrent * 2, queueTimeoutMs: profile.queueTimeoutMs });
    } else if (deadlineMs !== undefined) {
      client.deadline(deadlineMs);
    }
  };
  return isolated
    ? HttpClientFactory.createIsolated(baseURL, httpConfig, mergedPool, initialize)
    : HttpClientFactory.create(baseURL, httpConfig, mergedPool, initialize);
}

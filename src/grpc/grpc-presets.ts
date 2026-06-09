import type { GrpcClientConfig } from '../models/grpc.client.config';
import { ExponentialJitterRetryStrategy } from '../models/retry.strategy';

/**
 * gRPC preset configurations — same names as HTTP presets for a consistent
 * mental model across both protocols.
 *
 * Differences from HTTP presets:
 * - No connection-pool `maxSockets` (HTTP/2 multiplexes over sessions instead)
 * - `maxSessions` controls how many HTTP/2 connections to maintain
 * - Retry uses `isGrpcRetryable()` to honour gRPC status codes
 */

type GrpcPreset = Omit<GrpcClientConfig, 'preset' | 'on'>;

const GRPC_PRESETS: Record<string, GrpcPreset> = {
  /**
   * **high-throughput** — optimised for internal microservice calls.
   *
   * - 4 HTTP/2 sessions (more parallelism)
   * - 8 s timeout
   * - 1 fast retry
   * - No circuit breaker (trust the upstream)
   * - No bulkhead (let HTTP/2 flow control handle backpressure)
   */
  'high-throughput': {
    maxSessions: 4,
    timeoutMs: 8_000,
    retries: 1,
    retryStrategy: new ExponentialJitterRetryStrategy(50, 500),
    encoding: 'json',
    protocol: 'connect',
  },

  /**
   * **resilient-api** — for critical upstream services where failures matter.
   *
   * - 2 HTTP/2 sessions
   * - 15 s timeout
   * - 3 retries with exponential jitter
   * - Circuit breaker (opens after 10 failures, half-opens after 10 s)
   * - Bulkhead (50 concurrent RPCs, 200 queued)
   */
  'resilient-api': {
    maxSessions: 2,
    timeoutMs: 15_000,
    retries: 3,
    retryStrategy: new ExponentialJitterRetryStrategy(100, 10_000),
    circuitBreaker: {
      failureThreshold: 10,
      successThreshold: 3,
      timeoutMs: 10_000,
    },
    bulkhead: {
      maxConcurrent: 50,
      maxQueue: 200,
    },
    encoding: 'json',
    protocol: 'connect',
  },

  /**
   * **low-latency** — for real-time calls where speed > reliability.
   *
   * - 4 HTTP/2 sessions
   * - 2 s timeout
   * - No retry (fail fast)
   * - No circuit breaker
   * - No bulkhead
   */
  'low-latency': {
    maxSessions: 4,
    timeoutMs: 2_000,
    encoding: 'json',
    protocol: 'connect',
  },
};

/**
 * Applies a named gRPC preset to a `GrpcClientConfig`, with explicit config
 * fields taking precedence.
 */
export function applyGrpcPreset(config: GrpcClientConfig): GrpcClientConfig {
  if (!config.preset) return config;
  const preset = GRPC_PRESETS[config.preset];
  if (!preset) return config;
  // Preset is the base; explicit fields override
  return { ...preset, ...config };
}

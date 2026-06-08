import type { Preset } from '../presets/index';
import type { CircuitBreakerConfig } from '../circuit-breaker/circuit-break';
import type { BulkheadConfig } from '../bulkhead/bulkhead';
import type { RateLimitConfig } from '../rate-limiter/rate-limiter';
import type { RetryStrategy } from '../models/retry.strategy';
import type { ResilienceEvents } from '../models/resilience.events';

/**
 * Wire-encoding options for the gRPC transport.
 *
 * - `json`  — Connect-RPC JSON (`application/connect+json`). Default.
 *             Works without `.proto` files; JSON-serialisable TypeScript types only.
 * - `proto` — Connect-RPC protobuf binary (`application/connect+proto`).
 *             Requires your types to be `@bufbuild/protobuf` `Message` classes.
 */
export type GrpcEncoding = 'json' | 'proto';

/**
 * Protocol variant spoken by the transport.
 *
 * - `connect` — Connect-RPC (default). Modern, HTTP/1.1+HTTP/2, JSON or proto.
 * - `grpc`    — Standard gRPC over HTTP/2 (requires trailers). Binary proto only.
 * - `grpc-web`— gRPC-Web (no trailers, works through HTTP/1.1 proxies).
 */
export type GrpcProtocol = 'connect' | 'grpc' | 'grpc-web';

/**
 * Configuration for a {@link GrpcClient} instance.
 *
 * @example
 * ```ts
 * const client = createGrpcClient(UserServiceDef, 'grpcs://api.example.com:443', {
 *   preset:   'resilient-api',
 *   encoding: 'json',       // default — no proto files needed
 *   headers:  { 'x-api-key': 'secret' },
 * })
 * ```
 */
export interface GrpcClientConfig {
  /**
   * Apply a preset configuration profile.
   * Same names as HTTP presets: `'high-throughput'`, `'resilient-api'`, `'low-latency'`.
   * Preset settings are applied first; explicit fields below override them.
   */
  preset?: Preset;

  /**
   * Wire encoding. Defaults to `'json'` (no proto files required).
   * Set to `'proto'` when using `@bufbuild/protobuf` generated `Message` classes
   * for smaller payloads and strict schema validation.
   */
  encoding?: GrpcEncoding;

  /**
   * Protocol variant. Defaults to `'connect'` (Connect-RPC).
   * Use `'grpc'` for standard gRPC binary protocol (requires binary proto + trailers).
   */
  protocol?: GrpcProtocol;

  /**
   * Default request timeout in milliseconds.
   * Can be overridden per-call via the `timeoutMs` option on the call config.
   * @defaultValue 15000
   */
  timeoutMs?: number;

  /**
   * Default headers sent with every request.
   * Per-call metadata is merged on top of these.
   */
  headers?: Record<string, string>;

  // ─── Circuit breaker ────────────────────────────────────────────────────────

  /**
   * Circuit breaker configuration.
   * If omitted, the circuit breaker is disabled.
   */
  circuitBreaker?: CircuitBreakerConfig;

  // ─── Retry ─────────────────────────────────────────────────────────────────

  /**
   * Maximum number of retry attempts for retryable gRPC codes.
   * @defaultValue 0 (no retry unless preset enables it)
   */
  retries?: number;

  /**
   * Retry back-off strategy. Defaults to `ExponentialJitterRetryStrategy(100, 10_000)`.
   */
  retryStrategy?: RetryStrategy;

  // ─── Bulkhead ──────────────────────────────────────────────────────────────

  /**
   * Bulkhead isolation — limits concurrent in-flight RPCs.
   * If omitted, concurrency is unbounded.
   */
  bulkhead?: BulkheadConfig;

  // ─── Rate limiter ───────────────────────────────────────────────────────────

  /**
   * Token-bucket rate limiter — caps RPC rate.
   * If omitted, rate limiting is disabled.
   */
  rateLimit?: RateLimitConfig;

  // ─── Observability ─────────────────────────────────────────────────────────

  /**
   * Resilience event hooks — same interface as `HttpClient.on()`.
   *
   * @example
   * ```ts
   * {
   *   on: {
   *     onRetry:              ({ attempt }) => logger.warn(`gRPC retry #${attempt}`),
   *     onCircuitStateChange: ({ to })      => alerts.send(`circuit → ${to}`),
   *   }
   * }
   * ```
   */
  on?: ResilienceEvents;

  // ─── Connection pool ────────────────────────────────────────────────────────

  /**
   * Maximum number of HTTP/2 sessions (connections) to the same address.
   * Each session supports many concurrent streams via HTTP/2 multiplexing,
   * so this rarely needs to exceed 2–4.
   * @defaultValue 2
   */
  maxSessions?: number;
}

/**
 * Per-call options that override the client-level config for a single RPC.
 */
export interface GrpcCallOptions {
  /** Per-call request metadata (merged with client-level `headers`). */
  metadata?: Record<string, string>;
  /** Per-call timeout override (ms). */
  timeoutMs?: number;
  /** AbortSignal for manual cancellation. */
  signal?: AbortSignal;
  /** Disable retry for this call (e.g. non-idempotent mutations). */
  retry?: false;
}

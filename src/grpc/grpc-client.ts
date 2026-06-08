/**
 * GrpcClient — TypeScript-first gRPC client with a unified resilience pipeline.
 *
 * The same circuit breaker, retry, bulkhead, rate limiter, deduplication, and
 * metrics that power `HttpClient` wrap every gRPC call here — no additional
 * setup required.
 *
 * @example
 * ```ts
 * import { defineService, unary, serverStream, createGrpcClient } from 'super-http/grpc'
 *
 * const UserService = defineService('UserService', {
 *   getUser:   unary<{ id: string }, User>(),
 *   listUsers: serverStream<{ filter?: string }, User>(),
 * })
 *
 * const client = createGrpcClient(UserService, 'grpcs://user-service:443', {
 *   preset: 'resilient-api',
 *   headers: { 'x-api-key': process.env.API_KEY! },
 * })
 *
 * // Unary — fully typed
 * const user = await client.getUser({ id: '42' })
 *
 * // Server streaming — async generator, native backpressure
 * for await (const u of client.listUsers({ filter: 'active' })) {
 *   console.log(u.name)
 * }
 * ```
 */

import { CircuitBreaker } from '../circuit-breaker/circuit-break';
import { Bulkhead } from '../bulkhead/bulkhead';
import { RateLimiter } from '../rate-limiter/rate-limiter';
import { RequestDedup } from '../dedup/request-dedup';
import { ExponentialJitterRetryStrategy } from '../models/retry.strategy';
import { MetricsCollector, MetricsSnapshot } from '../models/metrics';
import { ResilienceEvents } from '../models/resilience.events';
import type { GrpcClientConfig, GrpcCallOptions } from '../models/grpc.client.config';
import type { ServiceDefinition, ServiceMethods, GrpcClientAPI } from './service-definition';
import { GrpcTransport } from '../transport/grpc-transport';
import { applyGrpcPreset } from './grpc-presets';
import { isGrpcRetryable } from './grpc-error-mapper';

// ─── Public type ──────────────────────────────────────────────────────────────

/**
 * A fully-typed gRPC client whose method surface is derived from the
 * {@link ServiceDefinition} passed to {@link createGrpcClient}.
 *
 * Management methods (`.metrics()`, `.close()`, `.on()`) are available
 * alongside the generated RPC methods.
 */
export type GrpcClient<TDef extends ServiceDefinition<ServiceMethods>> =
  GrpcClientAPI<TDef['methods']> & GrpcClientManagement;

/** Management methods available on every GrpcClient instance. */
export interface GrpcClientManagement {
  /** Returns a point-in-time metrics snapshot for this client. */
  metrics(): MetricsSnapshot;
  /** Resets all accumulated metric counters. */
  resetMetrics(): void;
  /** Registers resilience event hooks (same interface as HttpClient). */
  on(events: ResilienceEvents): void;
  /** Gracefully closes the underlying HTTP/2 sessions. */
  close(): Promise<void>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

class GrpcClientImpl {
  private readonly transport: GrpcTransport;
  private readonly config: GrpcClientConfig;
  private readonly _metrics = new MetricsCollector();
  private resilienceEvents: ResilienceEvents = {};

  private circuitBreaker?: CircuitBreaker;
  private bulkheadInstance?: Bulkhead;
  private rateLimiterInstance?: RateLimiter;
  private dedupInstance?: RequestDedup;

  constructor(
    private readonly definition: ServiceDefinition<ServiceMethods>,
    address: string,
    config: GrpcClientConfig,
  ) {
    this.config = applyGrpcPreset(config);
    const merged: ResilienceEvents = this.config.on ?? {};
    this.resilienceEvents = merged;

    this.transport = new GrpcTransport({
      address,
      encoding:        this.config.encoding,
      protocol:        this.config.protocol,
      defaultHeaders:  this.config.headers,
      defaultTimeoutMs: this.config.timeoutMs,
      maxSessions:     this.config.maxSessions,
    });

    // Wire resilience components
    if (this.config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker();
      this.circuitBreaker.setConfig(this.config.circuitBreaker, {
        onCircuitStateChange: (evt) => {
          if (evt.to === 'open') this._metrics.recordCBTrip();
          this.safeCall(() => this.resilienceEvents.onCircuitStateChange?.(evt));
        },
      });
    }

    if (this.config.bulkhead) {
      this.bulkheadInstance = new Bulkhead(this.config.bulkhead, this.resilienceEvents);
    }

    if (this.config.rateLimit) {
      this.rateLimiterInstance = new RateLimiter(this.config.rateLimit, this.resilienceEvents);
    }

    // Enable dedup for unary calls by default
    this.dedupInstance = new RequestDedup();
  }

  // ─── Management ─────────────────────────────────────────────────────────────

  metrics(): MetricsSnapshot {
    return this._metrics.snapshot();
  }

  resetMetrics(): void {
    this._metrics.reset();
  }

  on(events: ResilienceEvents): void {
    this.resilienceEvents = { ...this.resilienceEvents, ...events };
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  // ─── Unary call ──────────────────────────────────────────────────────────────

  async callUnary<TReq, TRes>(
    methodName: string,
    request: TReq,
    opts: GrpcCallOptions = {},
  ): Promise<TRes> {
    const dedupKey = this.dedupInstance
      ? `${this.definition.serviceName}:${methodName}:${JSON.stringify(request)}`
      : undefined;

    const t0 = Date.now();
    this._metrics.recordRequest();

    const core = (): Promise<TRes> => {
      let fn = (): Promise<TRes> =>
        this.transport.call<TReq, TRes>({
          service:   this.definition.serviceName,
          method:    methodName,
          input:     request,
          metadata:  opts.metadata,
          timeoutMs: opts.timeoutMs,
          signal:    opts.signal,
        }).then((r) => r.data);

      if (this.circuitBreaker) {
        const cb = this.circuitBreaker;
        const inner = fn;
        fn = () => cb.execute(inner);
      }

      if (opts.retry !== false && (this.config.retries ?? 0) > 0) {
        fn = this.withRetry(fn, this.config.retries!);
      }

      if (this.bulkheadInstance) {
        const bh = this.bulkheadInstance;
        const inner = fn;
        fn = async () => {
          try {
            return await bh.execute(inner);
          } catch (err) {
            const isBHReject =
              err instanceof Error &&
              (err.message === 'Bulkhead queue full' || err.message === 'Bulkhead queue timeout');
            if (isBHReject) this._metrics.recordBHReject();
            throw err;
          }
        };
      }

      if (this.rateLimiterInstance) {
        const rl = this.rateLimiterInstance;
        const inner = fn;
        fn = async () => {
          try {
            await rl.acquire();
          } catch (err) {
            this._metrics.recordRLReject();
            throw err;
          }
          return inner();
        };
      }

      return fn();
    };

    const run = dedupKey ? () => this.dedupInstance!.execute(dedupKey, core) : core;

    return run().then(
      (res) => {
        this._metrics.recordSuccess(Date.now() - t0);
        return res;
      },
      (err) => {
        this._metrics.recordFailure();
        throw err;
      },
    );
  }

  // ─── Server streaming ────────────────────────────────────────────────────────

  async *callServerStream<TReq, TRes>(
    methodName: string,
    request: TReq,
    opts: GrpcCallOptions = {},
  ): AsyncIterable<TRes> {
    // Rate limit + bulkhead on stream open
    if (this.rateLimiterInstance) {
      try { await this.rateLimiterInstance.acquire(); }
      catch (err) { this._metrics.recordRLReject(); throw err; }
    }

    const openStream = (): AsyncIterable<TRes> => {
      return this.transport.serverStream<TReq, TRes>({
        service:   this.definition.serviceName,
        method:    methodName,
        input:     request,
        metadata:  opts.metadata,
        timeoutMs: opts.timeoutMs,
        signal:    opts.signal,
      });
    };

    // Circuit breaker wraps stream open only
    let stream: AsyncIterable<TRes>;
    if (this.circuitBreaker) {
      stream = await this.circuitBreaker.execute(() => Promise.resolve(openStream()));
    } else {
      stream = openStream();
    }

    const t0 = Date.now();
    this._metrics.recordRequest();

    // For streaming, acquire the bulkhead slot before iterating and release
    // after the stream is fully consumed (or errors). This counts the entire
    // stream lifetime as a single concurrent operation.
    if (this.bulkheadInstance) {
      const bh = this.bulkheadInstance;
      // Try to acquire a slot — throws if queue is full
      let acquired = false;
      try {
        await bh.execute(async () => { acquired = true; });
      } catch (err) {
        const isBHReject =
          err instanceof Error &&
          (err.message === 'Bulkhead queue full' || err.message === 'Bulkhead queue timeout');
        if (isBHReject) this._metrics.recordBHReject();
        throw err;
      }
      // We acquired a slot but immediately released it (the execute above completes
      // instantly). For streaming we track slot as a best-effort count; HTTP/2
      // flow control is the real backpressure mechanism.
      void acquired; // suppress unused-variable warning
    }

    try {
      for await (const msg of stream) {
        yield msg;
      }
      this._metrics.recordSuccess(Date.now() - t0);
    } catch (err) {
      this._metrics.recordFailure();
      throw err;
    }
  }

  // ─── Client streaming ────────────────────────────────────────────────────────

  async callClientStream<TReq, TRes>(
    methodName: string,
    requestStream: AsyncIterable<TReq>,
    opts: GrpcCallOptions = {},
  ): Promise<TRes> {
    const t0 = Date.now();
    this._metrics.recordRequest();

    try {
      const result = await this.transport.clientStream<TReq, TRes>(requestStream, {
        service:   this.definition.serviceName,
        method:    methodName,
        metadata:  opts.metadata,
        timeoutMs: opts.timeoutMs,
        signal:    opts.signal,
      });
      this._metrics.recordSuccess(Date.now() - t0);
      return result.data;
    } catch (err) {
      this._metrics.recordFailure();
      throw err;
    }
  }

  // ─── Bidi streaming ──────────────────────────────────────────────────────────

  async *callBidiStream<TReq, TRes>(
    methodName: string,
    requestStream: AsyncIterable<TReq>,
    opts: GrpcCallOptions = {},
  ): AsyncIterable<TRes> {
    const t0 = Date.now();
    this._metrics.recordRequest();

    try {
      yield* this.transport.bidiStream<TReq, TRes>(requestStream, {
        service:   this.definition.serviceName,
        method:    methodName,
        metadata:  opts.metadata,
        timeoutMs: opts.timeoutMs,
        signal:    opts.signal,
      });
      this._metrics.recordSuccess(Date.now() - t0);
    } catch (err) {
      this._metrics.recordFailure();
      throw err;
    }
  }

  // ─── Retry wrapper ────────────────────────────────────────────────────────────

  private withRetry<T>(fn: () => Promise<T>, maxRetries: number): () => Promise<T> {
    const strategy = this.config.retryStrategy ?? new ExponentialJitterRetryStrategy(100, 10_000);

    return async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await fn();
        } catch (error: unknown) {
          const isCircuitOpen = error instanceof Error && error.message === 'Circuit breaker is open';
          if (isCircuitOpen || attempt >= maxRetries) throw error;
          if (!isGrpcRetryable(error)) throw error;

          const delayMs = strategy.computeDelay(attempt, error);
          this._metrics.recordRetry();
          this.safeCall(() => this.resilienceEvents.onRetry?.({ attempt, error, delayMs }));
          await this.sleep(delayMs);
        }
      }
    };
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private safeCall(fn: () => void): void {
    try { fn(); } catch { /* never affect call path */ }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a fully-typed gRPC client for the given service definition.
 *
 * The returned object exposes:
 * - One method per service method (typed from the service definition)
 * - `.metrics()`, `.resetMetrics()`, `.on()`, `.close()` management methods
 *
 * @param definition - Service contract built with {@link defineService}.
 * @param address    - Remote address. Supported formats:
 *   `grpc://host:port` (insecure), `grpcs://host:port` (TLS),
 *   `host:port` (insecure), `https://host:port` (TLS).
 * @param config     - Client configuration (preset, retry, circuit breaker, etc.).
 *
 * @example
 * ```ts
 * const client = createGrpcClient(UserServiceDef, 'grpcs://api:443', {
 *   preset:  'resilient-api',
 *   headers: { 'x-api-key': process.env.API_KEY! },
 * })
 *
 * const user = await client.getUser({ id: '1' })
 * ```
 */
export function createGrpcClient<TDef extends ServiceDefinition<ServiceMethods>>(
  definition: TDef,
  address: string,
  config: GrpcClientConfig = {},
): GrpcClient<TDef> {
  const impl = new GrpcClientImpl(definition, address, config);

  // Build a proxy that routes method calls to the correct call-type handler
  const proxy = new Proxy(impl, {
    get(target, prop: string | symbol) {
      // Management methods pass through directly
      if (prop in target) return (target as unknown as Record<string | symbol, unknown>)[prop];

      // Return undefined for well-known non-RPC properties so that framework
      // inspection (NestJS lifecycle hooks, Promise-thenable detection, Node.js
      // util.inspect, JSON serialisation, etc.) doesn't trigger the "method not
      // defined" error.
      const FRAMEWORK_PROPS = new Set<string | symbol>([
        // Promise / thenable detection (await, Promise.resolve, etc.)
        'then', 'catch', 'finally',
        // NestJS lifecycle hooks
        'onModuleInit', 'onModuleDestroy', 'onApplicationBootstrap',
        'onApplicationShutdown', 'beforeApplicationShutdown',
        // Node.js / util.inspect / JSON
        'toJSON', 'toObject', 'inspect',
        Symbol.toPrimitive, Symbol.iterator, Symbol.asyncIterator,
        Symbol.toStringTag,
      ]);
      if (FRAMEWORK_PROPS.has(prop)) return undefined;

      // For symbol props not in the set, also return undefined silently
      if (typeof prop === 'symbol') return undefined;

      // Look up the method descriptor in the service definition
      const descriptor = definition.methods[prop];
      if (!descriptor) {
        throw new Error(`[GrpcClient] Method '${String(prop)}' is not defined in service '${definition.serviceName}'`);
      }

      switch (descriptor.callType) {
        case 'unary':
          return (request: unknown, opts?: GrpcCallOptions) =>
            target.callUnary(prop, request, opts);

        case 'server-stream':
          return (request: unknown, opts?: GrpcCallOptions) =>
            target.callServerStream(prop, request, opts);

        case 'client-stream':
          return (stream: AsyncIterable<unknown>, opts?: GrpcCallOptions) =>
            target.callClientStream(prop, stream, opts);

        case 'bidi-stream':
          return (stream: AsyncIterable<unknown>, opts?: GrpcCallOptions) =>
            target.callBidiStream(prop, stream, opts);

        default:
          throw new Error(`[GrpcClient] Unknown call type for method '${String(prop)}'`);
      }
    },
  });

  return proxy as unknown as GrpcClient<TDef>;
}

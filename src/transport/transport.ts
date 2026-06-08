/**
 * Transport abstraction — the minimal interface that separates "how bytes travel"
 * from "how resilience is applied". Both {@link HttpClient} and {@link GrpcClient}
 * use transports under the hood; all resilience primitives (CircuitBreaker,
 * Bulkhead, Retry, etc.) are transport-agnostic.
 */

export interface TransportMeta {
  /** Fully qualified service name, e.g. `"UserService"` or `"acme.v1.UserService"`. */
  service: string;
  /** Method name as defined in the service, e.g. `"GetUser"`. */
  method: string;
  /** Optional request metadata / headers forwarded to the remote. */
  metadata?: Record<string, string>;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Per-call timeout override (ms). */
  timeoutMs?: number;
}

export interface TransportRequest<TReq = unknown> extends TransportMeta {
  /** The request message (will be serialised by the transport). */
  input: TReq;
}

export interface TransportResponse<TRes = unknown> {
  /** The decoded response message. */
  data: TRes;
  /** Response metadata / headers returned by the remote. */
  metadata?: Record<string, string>;
  /** The underlying transport type that handled this call. */
  transportType: 'http' | 'grpc';
}

/**
 * Minimal transport interface. Implement this to add a new protocol to super-http
 * without touching any resilience logic.
 *
 * super-http ships two implementations:
 * - `AxiosTransport` — wraps the existing Axios-based `HttpClient` (internal)
 * - `GrpcTransport`  — Connect-RPC JSON over HTTP/2 via native `node:http2`
 */
export interface Transport {
  /** Identifies the protocol this transport speaks. */
  readonly type: 'http' | 'grpc';

  /**
   * Unary RPC — single request, single response.
   */
  call<TReq, TRes>(request: TransportRequest<TReq>): Promise<TransportResponse<TRes>>;

  /**
   * Server-streaming RPC — single request, stream of responses.
   * The returned `AsyncIterable` is consumer-paced: calling `.next()` drives
   * HTTP/2 flow control automatically.
   */
  serverStream<TReq, TRes>(request: TransportRequest<TReq>): AsyncIterable<TRes>;

  /**
   * Client-streaming RPC — stream of requests, single response.
   */
  clientStream<TReq, TRes>(
    stream: AsyncIterable<TReq>,
    meta: TransportMeta,
  ): Promise<TransportResponse<TRes>>;

  /**
   * Bidirectional-streaming RPC — stream of requests, stream of responses.
   */
  bidiStream<TReq, TRes>(
    stream: AsyncIterable<TReq>,
    meta: TransportMeta,
  ): AsyncIterable<TRes>;

  /**
   * Gracefully closes the underlying connection(s).
   * After this call the transport must not be reused.
   */
  close(): Promise<void>;
}

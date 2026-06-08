/**
 * TypeScript-first service contract DSL.
 *
 * Define gRPC services as plain TypeScript — no `.proto` files, no code
 * generation. Types flow through the entire call chain, from request to
 * response, including streaming.
 *
 * @example
 * ```ts
 * import { defineService, unary, serverStream, clientStream, bidi } from 'super-http/grpc'
 *
 * const UserServiceDef = defineService('UserService', {
 *   getUser:    unary<GetUserRequest, User>(),
 *   listUsers:  serverStream<ListFilter, User>(),
 *   uploadLogs: clientStream<Log, UploadSummary>(),
 *   chat:       bidi<ChatMessage, ChatMessage>(),
 * })
 * ```
 */

// ─── Call-type brands ─────────────────────────────────────────────────────────

/** Phantom-typed descriptor for a unary RPC method. */
export interface UnaryMethodDescriptor<TReq, TRes> {
  readonly callType: 'unary';
  /** @internal Phantom field — only used for TypeScript type inference. */
  readonly _req?: TReq;
  /** @internal Phantom field — only used for TypeScript type inference. */
  readonly _res?: TRes;
}

/** Phantom-typed descriptor for a server-streaming RPC method. */
export interface ServerStreamMethodDescriptor<TReq, TRes> {
  readonly callType: 'server-stream';
  readonly _req?: TReq;
  readonly _res?: TRes;
}

/** Phantom-typed descriptor for a client-streaming RPC method. */
export interface ClientStreamMethodDescriptor<TReq, TRes> {
  readonly callType: 'client-stream';
  readonly _req?: TReq;
  readonly _res?: TRes;
}

/** Phantom-typed descriptor for a bidirectional-streaming RPC method. */
export interface BidiStreamMethodDescriptor<TReq, TRes> {
  readonly callType: 'bidi-stream';
  readonly _req?: TReq;
  readonly _res?: TRes;
}

/** Union of all method descriptor types. */
export type MethodDescriptor<TReq = unknown, TRes = unknown> =
  | UnaryMethodDescriptor<TReq, TRes>
  | ServerStreamMethodDescriptor<TReq, TRes>
  | ClientStreamMethodDescriptor<TReq, TRes>
  | BidiStreamMethodDescriptor<TReq, TRes>;

// ─── Service definition ────────────────────────────────────────────────────────

/** Map of method name → descriptor, used to define a service. */
export type ServiceMethods = Record<string, MethodDescriptor<unknown, unknown>>;

/**
 * Complete service definition produced by {@link defineService}.
 * This is the single source of truth that drives both compile-time types
 * and runtime dispatch.
 */
export interface ServiceDefinition<TMethods extends ServiceMethods = ServiceMethods> {
  /** Fully-qualified service name, e.g. `"acme.v1.UserService"`. */
  readonly serviceName: string;
  /** Method descriptors keyed by method name. */
  readonly methods: TMethods;
}

// ─── Type helpers ──────────────────────────────────────────────────────────────

/** Extracts the request type from a method descriptor. */
export type RequestOf<M extends MethodDescriptor> = NonNullable<M['_req']>;

/** Extracts the response type from a method descriptor. */
export type ResponseOf<M extends MethodDescriptor> = NonNullable<M['_res']>;

/**
 * Derives the callable client API shape from a service definition's methods map.
 *
 * - Unary         → `(req: TReq) => Promise<TRes>`
 * - Server-stream → `(req: TReq) => AsyncIterable<TRes>`
 * - Client-stream → `(stream: AsyncIterable<TReq>) => Promise<TRes>`
 * - Bidi-stream   → `(stream: AsyncIterable<TReq>) => AsyncIterable<TRes>`
 */
export type GrpcClientAPI<TMethods extends ServiceMethods> = {
  [K in keyof TMethods]: TMethods[K] extends UnaryMethodDescriptor<infer TReq, infer TRes>
    ? (request: TReq) => Promise<TRes>
    : TMethods[K] extends ServerStreamMethodDescriptor<infer TReq, infer TRes>
    ? (request: TReq) => AsyncIterable<TRes>
    : TMethods[K] extends ClientStreamMethodDescriptor<infer TReq, infer TRes>
    ? (stream: AsyncIterable<TReq>) => Promise<TRes>
    : TMethods[K] extends BidiStreamMethodDescriptor<infer TReq, infer TRes>
    ? (stream: AsyncIterable<TReq>) => AsyncIterable<TRes>
    : never;
};

// ─── DSL helpers ──────────────────────────────────────────────────────────────

/**
 * Describes a unary RPC — one request message, one response message.
 *
 * @example
 * ```ts
 * getUser: unary<GetUserRequest, User>()
 * ```
 */
export function unary<TReq, TRes>(): UnaryMethodDescriptor<TReq, TRes> {
  return { callType: 'unary' } as UnaryMethodDescriptor<TReq, TRes>;
}

/**
 * Describes a server-streaming RPC — one request, a stream of responses.
 *
 * @example
 * ```ts
 * listUsers: serverStream<ListFilter, User>()
 * ```
 */
export function serverStream<TReq, TRes>(): ServerStreamMethodDescriptor<TReq, TRes> {
  return { callType: 'server-stream' } as ServerStreamMethodDescriptor<TReq, TRes>;
}

/**
 * Describes a client-streaming RPC — a stream of requests, one response.
 *
 * @example
 * ```ts
 * uploadLogs: clientStream<LogEntry, UploadSummary>()
 * ```
 */
export function clientStream<TReq, TRes>(): ClientStreamMethodDescriptor<TReq, TRes> {
  return { callType: 'client-stream' } as ClientStreamMethodDescriptor<TReq, TRes>;
}

/**
 * Describes a bidirectional-streaming RPC — streams in both directions.
 *
 * @example
 * ```ts
 * chat: bidi<ChatMessage, ChatMessage>()
 * ```
 */
export function bidi<TReq, TRes>(): BidiStreamMethodDescriptor<TReq, TRes> {
  return { callType: 'bidi-stream' } as BidiStreamMethodDescriptor<TReq, TRes>;
}

/**
 * Creates a {@link ServiceDefinition} — the TypeScript-first contract for a
 * gRPC service. No `.proto` files or code generation required.
 *
 * @param serviceName - Fully-qualified service name (used in the HTTP/2 path).
 * @param methods     - Map of method name → descriptor built with {@link unary},
 *                      {@link serverStream}, {@link clientStream}, or {@link bidi}.
 *
 * @example
 * ```ts
 * const UserServiceDef = defineService('UserService', {
 *   getUser:    unary<GetUserRequest, User>(),
 *   listUsers:  serverStream<ListFilter, User>(),
 *   uploadLogs: clientStream<LogEntry, UploadSummary>(),
 * })
 * ```
 */
export function defineService<TMethods extends ServiceMethods>(
  serviceName: string,
  methods: TMethods,
): ServiceDefinition<TMethods> {
  return { serviceName, methods };
}

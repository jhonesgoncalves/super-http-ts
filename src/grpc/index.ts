/**
 * super-http gRPC integration — TypeScript-first gRPC clients with a unified
 * resilience pipeline (same circuit breaker, retry, bulkhead, and metrics as
 * the HTTP transport).
 *
 * Entry point: `super-http/grpc`
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
 * })
 *
 * const user = await client.getUser({ id: '1' })
 * for await (const u of client.listUsers({})) { console.log(u) }
 * ```
 */

// ─── Service definition DSL ───────────────────────────────────────────────────
export { defineService, unary, serverStream, clientStream, bidi } from './service-definition';

export type {
  ServiceDefinition,
  ServiceMethods,
  MethodDescriptor,
  UnaryMethodDescriptor,
  ServerStreamMethodDescriptor,
  ClientStreamMethodDescriptor,
  BidiStreamMethodDescriptor,
  GrpcClientAPI,
  RequestOf,
  ResponseOf,
} from './service-definition';

// ─── Client factory ───────────────────────────────────────────────────────────
export { createGrpcClient } from './grpc-client';
export type { GrpcClient, GrpcClientManagement } from './grpc-client';

// ─── Configuration types ──────────────────────────────────────────────────────
export type { GrpcClientConfig, GrpcCallOptions, GrpcEncoding, GrpcProtocol } from '../models/grpc.client.config';

// ─── Error types ──────────────────────────────────────────────────────────────
export { GrpcError, getDecision, isGrpcRetryable, shouldTripCircuit } from './grpc-error-mapper';
export type { GrpcCode, GrpcErrorDecision } from './grpc-error-mapper';

// ─── Channel registry (for advanced use and testing) ─────────────────────────
export { GrpcChannelRegistry } from './grpc-channel-registry';

// ─── Transport (for advanced / custom use) ────────────────────────────────────
export { GrpcTransport } from '../transport/grpc-transport';
export type { Transport, TransportRequest, TransportResponse, TransportMeta } from '../transport/transport';

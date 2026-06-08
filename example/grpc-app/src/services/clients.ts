/**
 * gRPC Clients — configured with resilience presets
 *
 * Each client targets the local mock server and applies a
 * different resilience configuration to showcase the options.
 */

import { createGrpcClient } from 'super-http/grpc'
import { ExponentialJitterRetryStrategy } from 'super-http'
import {
  UserServiceDef,
  ProductServiceDef,
  OrderServiceDef,
  LogServiceDef,
  ChatServiceDef,
} from './definitions'

const MOCK_SERVER = process.env.GRPC_SERVER ?? 'http://localhost:50051'

// ─── UserService client — resilient-api preset ────────────────────────────────
// Circuit breaker + retry x3 + bulkhead(20 concurrent)
export const userClient = createGrpcClient(
  UserServiceDef,
  MOCK_SERVER,
  {
    preset: 'resilient-api',
    headers: { 'x-service': 'grpc-example' },
    on: {
      onRetry: ({ attempt, error }) =>
        console.warn(`  [UserService] retry #${attempt}: ${String(error)}`),
      onCircuitStateChange: ({ from, to, failures }) =>
        console.warn(`  [UserService] circuit ${from} → ${to} (${failures} failures)`),
      onBulkheadReject: ({ active }) =>
        console.warn(`  [UserService] bulkhead full (${active} active)`),
    },
  },
)

// ─── ProductService client — high-throughput preset ──────────────────────────
// 4 sessions, light retry, no circuit breaker
export const productClient = createGrpcClient(
  ProductServiceDef,
  MOCK_SERVER,
  {
    preset: 'high-throughput',
    headers: { 'x-service': 'grpc-example' },
  },
)

// ─── OrderService client — manual full config ─────────────────────────────────
// Custom circuit breaker + exponential jitter retry + rate limit
export const orderClient = createGrpcClient(
  OrderServiceDef,
  MOCK_SERVER,
  {
    timeoutMs: 10_000,
    maxSessions: 2,
    retries: 3,
    retryStrategy: new ExponentialJitterRetryStrategy(200, 8_000),
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 15_000,
    },
    bulkhead: {
      maxConcurrent: 30,
      maxQueue: 100,
    },
    rateLimit: {
      permitLimit: 100,
      windowMs: 1_000,
    },
    headers: { 'x-service': 'grpc-example' },
    on: {
      onRetry: ({ attempt, delayMs }) =>
        console.warn(`  [OrderService] retry #${attempt} in ${delayMs}ms`),
      onCircuitStateChange: ({ to }) =>
        to === 'open' && console.error('  [OrderService] circuit OPEN — failing fast'),
    },
  },
)

// ─── LogService client — low-latency preset ───────────────────────────────────
// Fast timeout, no retry (log upload is fire-and-forward)
export const logClient = createGrpcClient(
  LogServiceDef,
  MOCK_SERVER,
  {
    preset: 'low-latency',
    headers: { 'x-service': 'grpc-example' },
  },
)

// ─── ChatService client — minimal config ──────────────────────────────────────
export const chatClient = createGrpcClient(
  ChatServiceDef,
  MOCK_SERVER,
  {
    timeoutMs: 30_000,
    maxSessions: 1,
    headers: { 'x-service': 'grpc-example' },
  },
)

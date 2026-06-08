/**
 * Maps Connect-RPC / gRPC status codes to super-http resilience decisions.
 *
 * This is what makes the gRPC integration genuinely production-grade: rather
 * than retrying everything (which can amplify problems) or nothing (which hides
 * transient failures), each code is mapped to one of three behaviours:
 *
 * - **retryable**   — transient; a retry has a realistic chance of succeeding
 * - **trip-worthy** — persistent; count towards the circuit-breaker threshold
 * - **terminal**    — immediate failure; don't retry, don't trip the circuit
 *
 * Reference: https://connectrpc.com/docs/protocol#error-codes
 */

/** Connect-RPC / gRPC error codes (as returned in the JSON error body). */
export type GrpcCode =
  | 'canceled'
  | 'unknown'
  | 'invalid_argument'
  | 'deadline_exceeded'
  | 'not_found'
  | 'already_exists'
  | 'permission_denied'
  | 'resource_exhausted'
  | 'failed_precondition'
  | 'aborted'
  | 'out_of_range'
  | 'unimplemented'
  | 'internal'
  | 'unavailable'
  | 'data_loss'
  | 'unauthenticated';

/** Resilience decision for a given gRPC error. */
export interface GrpcErrorDecision {
  /** Whether the operation should be retried. */
  retryable: boolean;
  /**
   * Whether this failure should count towards the circuit-breaker trip
   * threshold. Codes that indicate client errors (bad args, not found, etc.)
   * should NOT trip the circuit — only server-side or network faults should.
   */
  tripCircuit: boolean;
}

const DECISIONS: Record<GrpcCode, GrpcErrorDecision> = {
  canceled:           { retryable: false, tripCircuit: false },
  unknown:            { retryable: true,  tripCircuit: true  },
  invalid_argument:   { retryable: false, tripCircuit: false },
  deadline_exceeded:  { retryable: true,  tripCircuit: true  },
  not_found:          { retryable: false, tripCircuit: false },
  already_exists:     { retryable: false, tripCircuit: false },
  permission_denied:  { retryable: false, tripCircuit: false },
  resource_exhausted: { retryable: true,  tripCircuit: false }, // backpressure — retry after delay
  failed_precondition:{ retryable: false, tripCircuit: false },
  aborted:            { retryable: true,  tripCircuit: false }, // optimistic-lock conflict — retry ok
  out_of_range:       { retryable: false, tripCircuit: false },
  unimplemented:      { retryable: false, tripCircuit: false },
  internal:           { retryable: false, tripCircuit: true  }, // server bug — trip, don't retry
  unavailable:        { retryable: true,  tripCircuit: true  }, // service down — retry AND trip
  data_loss:          { retryable: false, tripCircuit: true  },
  unauthenticated:    { retryable: false, tripCircuit: false },
};

/**
 * Structured error thrown for all non-OK gRPC / Connect-RPC responses.
 * Cast to this type inside `onError` hooks or catch blocks to inspect the code.
 */
export class GrpcError extends Error {
  constructor(
    public readonly code: GrpcCode,
    message: string,
    public readonly details?: unknown[],
    public readonly metadata?: Record<string, string>,
  ) {
    super(message);
    this.name = 'GrpcError';
  }
}

/**
 * Returns the resilience decision for a given gRPC code.
 * Falls back to `{ retryable: false, tripCircuit: true }` for unknown codes.
 */
export function getDecision(code: string): GrpcErrorDecision {
  return DECISIONS[code as GrpcCode] ?? { retryable: false, tripCircuit: true };
}

/** Returns `true` if the error should be retried by the retry layer. */
export function isGrpcRetryable(error: unknown): boolean {
  if (error instanceof GrpcError) return getDecision(error.code).retryable;
  // Network-level errors (connection refused, timeout, etc.) are also retryable
  if (error && typeof error === 'object') {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === 'string') {
      const networkRetryable = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND']);
      if (networkRetryable.has(code)) return true;
    }
  }
  return false;
}

/** Returns `true` if the error should count towards the circuit-breaker threshold. */
export function shouldTripCircuit(error: unknown): boolean {
  if (error instanceof GrpcError) return getDecision(error.code).tripCircuit;
  return true; // unknown errors trip the circuit by default
}

import { AxiosResponse } from 'axios';

/**
 * Configuration options for the {@link CircuitBreaker}.
 *
 * @example
 * ```ts
 * const config: CircuitBreakerConfig = {
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeoutMs: 10_000,
 * };
 * ```
 */
export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures required to trip (open) the circuit.
   * Once this threshold is reached, requests fail immediately without
   * reaching the upstream service.
   */
  failureThreshold: number;

  /**
   * Number of consecutive successes required to close the circuit after
   * a successful probe in the half-open state.
   */
  successThreshold: number;

  /**
   * Time in milliseconds the circuit stays open before allowing a single
   * probe request through (half-open state).
   */
  timeoutMs: number;
}

/**
 * A simple three-state circuit breaker (closed → open → half-open).
 *
 * **States:**
 * - **Closed** — requests flow normally. Failures are counted.
 * - **Open** — requests fail immediately with `"Circuit breaker is open"`.
 *   After `timeoutMs` the circuit moves to half-open.
 * - **Half-open** — a single probe is allowed through. Success closes the
 *   circuit; failure re-opens it and resets the timeout.
 *
 * @example
 * ```ts
 * const cb = new CircuitBreaker();
 * cb.setConfig({ failureThreshold: 3, successThreshold: 1, timeoutMs: 5000 });
 *
 * const response = await cb.execute(() => axios.get('/api/data'));
 * ```
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;

  /** Whether the circuit is currently open (tripped). */
  isOpen = false;

  private config?: CircuitBreakerConfig;

  /**
   * Sets or updates the circuit breaker configuration.
   * @param config - The new {@link CircuitBreakerConfig}.
   */
  public setConfig(config: CircuitBreakerConfig): void {
    this.config = config;
  }

  /**
   * Wraps an async function with circuit-breaker protection.
   *
   * @typeParam T - The type of the resolved value.
   * @param fn - The async function to protect.
   * @returns A promise that resolves with the function's result.
   * @throws `Error('Circuit breaker is open')` when the circuit is tripped
   *         and the timeout has not yet elapsed.
   */
  async execute<T>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    if (this.isOpen) {
      if (this.shouldAttemptReset()) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const response = await fn();
      this.handleSuccess();
      return response;
    } catch (error) {
      this.handleFailure();
      throw error;
    }
  }

  /**
   * Checks the open state and throws if the circuit is open and the timeout
   * has not elapsed.  Useful for guard-checking before initiating work that
   * isn't wrapped via {@link execute}.
   *
   * @returns `false` when the circuit is closed (requests may proceed).
   * @throws `Error('Circuit breaker is open')` when the circuit is open.
   */
  public handleIsOpen(): boolean {
    if (this.isOpen) {
      if (this.shouldAttemptReset()) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    return this.isOpen;
  }

  private handleSuccess(): void {
    this.successes++;
    if (this.successes >= (this.config?.successThreshold ?? 1)) {
      this.reset();
    }
  }

  private handleFailure(): void {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailureTime;

    if (timeSinceLastFailure >= (this.config?.timeoutMs ?? 0)) {
      this.failures = 1;
    } else {
      this.failures++;
    }

    this.lastFailureTime = now;

    if (this.failures >= (this.config?.failureThreshold ?? 1)) {
      this.trip();
    }
  }

  private trip(): void {
    this.isOpen = true;
    this.lastFailureTime = Date.now();
  }

  private reset(): void {
    this.successes = 0;
    this.failures = 0;
    this.isOpen = false;
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= (this.config?.timeoutMs ?? 0);
  }
}

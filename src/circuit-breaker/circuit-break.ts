import { AxiosResponse } from 'axios';
import { CircuitState, CircuitStateChangeEvent, ResilienceEvents } from '../models/resilience.events';

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
   */
  failureThreshold: number;

  /**
   * Number of consecutive successes required to close the circuit from
   * the half-open state.
   */
  successThreshold: number;

  /**
   * Time in milliseconds the circuit stays open before allowing a single
   * probe request through (half-open state).
   */
  timeoutMs: number;
}

/**
 * A three-state circuit breaker (closed → open → half-open).
 *
 * Inspired by Polly's `CircuitBreakerPolicy` and Resilience4j's `CircuitBreaker`.
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
 * cb.setConfig(
 *   { failureThreshold: 3, successThreshold: 1, timeoutMs: 5000 },
 *   { onCircuitStateChange: ({ from, to }) => console.log(`${from} → ${to}`) },
 * );
 * const response = await cb.execute(() => axios.get('/api/data'));
 * ```
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private _state: CircuitState = 'closed';
  private config?: CircuitBreakerConfig;
  private events?: Pick<ResilienceEvents, 'onCircuitStateChange'>;

  /** Current circuit state. */
  get state(): CircuitState {
    return this._state;
  }

  /** `true` when the circuit is open (tripped). */
  get isOpen(): boolean {
    return this._state === 'open';
  }

  /**
   * Sets or updates the circuit breaker configuration and optional event hooks.
   *
   * @param config - The new {@link CircuitBreakerConfig}.
   * @param events - Optional observability hooks.
   */
  public setConfig(
    config: CircuitBreakerConfig,
    events?: Pick<ResilienceEvents, 'onCircuitStateChange'>,
  ): void {
    this.config = config;
    if (events) this.events = events;
  }

  /**
   * Wraps an async function with circuit-breaker protection.
   *
   * @throws `Error('Circuit breaker is open')` when the circuit is open and
   *   the timeout has not elapsed.
   */
  async execute<T>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    if (this._state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
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
   * Guard check: throws if the circuit is open and timeout has not elapsed.
   * Returns `false` when the circuit is closed (safe to proceed).
   */
  public handleIsOpen(): boolean {
    if (this._state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    return this._state === 'open';
  }

  private handleSuccess(): void {
    this.successes++;
    if (this.successes >= (this.config?.successThreshold ?? 1)) {
      this.transitionTo('closed');
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
      this.transitionTo('open');
    }
  }

  private transitionTo(next: CircuitState): void {
    const prev = this._state;
    if (prev === next) return;

    this._state = next;

    if (next === 'open') {
      this.lastFailureTime = Date.now();
    }

    if (next === 'closed') {
      this.successes = 0;
      this.failures = 0;
    }

    const event: CircuitStateChangeEvent = { from: prev, to: next, failures: this.failures };
    this.safeCall(() => this.events?.onCircuitStateChange?.(event));
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= (this.config?.timeoutMs ?? 0);
  }

  private safeCall(fn: () => void): void {
    try { fn(); } catch { /* never affect request path */ }
  }
}

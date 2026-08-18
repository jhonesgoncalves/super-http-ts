import { CircuitState, CircuitStateChangeEvent, ResilienceEvents } from '../models/resilience.events';
import { assertDuration, assertIntAtLeast } from '../models/validate';

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

  /**
   * Decides whether an error counts toward `failureThreshold`.
   *
   * A circuit breaker is supposed to track the health of the integration point,
   * not the caller's mistakes. Without this predicate every rejection counts, so
   * a burst of `404`s or `401`s — answers from a perfectly healthy upstream —
   * trips the circuit and takes down the traffic that was working.
   *
   * Errors the predicate rejects propagate to the caller unchanged; they simply
   * do not move the failure counter. Defaults to counting everything.
   */
  shouldTrip?: (error: unknown) => boolean;
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
  private probeInFlight = false;
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
   * Intended to be called **once**, at wiring time. Reconfiguring a breaker
   * that is already accumulating state changes the thresholds the existing
   * counters are compared against — prefer a dedicated instance per config.
   *
   * @param config - The new {@link CircuitBreakerConfig}.
   * @param events - Optional observability hooks.
   */
  public setConfig(config: CircuitBreakerConfig, events?: Pick<ResilienceEvents, 'onCircuitStateChange'>): void {
    // A threshold of 0 trips on the first failure and never recovers, which reads
    // as "the breaker is broken" rather than "the config is wrong".
    assertIntAtLeast(config.failureThreshold, 1, 'circuitBreaker.failureThreshold');
    assertIntAtLeast(config.successThreshold, 1, 'circuitBreaker.successThreshold');
    assertDuration(config.timeoutMs, 'circuitBreaker.timeoutMs');

    this.config = config;
    if (events) this.events = events;
  }

  /** `true` when this breaker has never been configured. */
  public get isConfigured(): boolean {
    return this.config !== undefined;
  }

  /**
   * Wraps an async function with circuit-breaker protection.
   *
   * @throws `Error('Circuit breaker is open')` when the circuit is open and
   *   the timeout has not elapsed, or when the circuit is half-open and a
   *   probe request is already in flight.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this._state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    // Half-open allows exactly one probe at a time: letting every concurrent
    // caller through would stampede an upstream that is still recovering.
    const isProbe = this._state === 'half-open';
    if (isProbe) {
      if (this.probeInFlight) throw new Error('Circuit breaker is open');
      this.probeInFlight = true;
    }

    try {
      const response = await fn();
      this.handleSuccess();
      return response;
    } catch (error) {
      // An error the predicate rejects says nothing about upstream health, so it
      // moves neither counter — in half-open it leaves the circuit half-open for
      // the next real probe rather than closing or re-opening on a client error.
      if (this.countsAsFailure(error)) this.handleFailure();
      throw error;
    } finally {
      if (isProbe) this.probeInFlight = false;
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
    if (this._state === 'half-open') {
      this.successes++;
      if (this.successes >= (this.config?.successThreshold ?? 1)) {
        this.transitionTo('closed');
      }
      return;
    }

    // Closed: a success breaks the failure streak. Without this the counter is
    // cumulative rather than consecutive, and a healthy service with a low
    // baseline error rate trips the breaker on its own.
    this.failures = 0;
  }

  private handleFailure(): void {
    this.lastFailureTime = Date.now();

    // Half-open probe failed — the upstream is still down, re-open immediately
    // without waiting for failureThreshold to be reached again.
    if (this._state === 'half-open') {
      this.failures++;
      this.transitionTo('open');
      return;
    }

    this.failures++;
    if (this.failures >= (this.config?.failureThreshold ?? 1)) {
      this.transitionTo('open');
    }
  }

  private transitionTo(next: CircuitState): void {
    const prev = this._state;
    if (prev === next) return;

    this._state = next;

    // Reported before the counters are cleared below, so close/half-open
    // events carry the streak that actually caused the transition.
    const failuresAtTransition = this.failures;

    if (next === 'open') {
      this.lastFailureTime = Date.now();
      this.successes = 0;
    }

    if (next === 'half-open') {
      this.successes = 0;
      this.failures = 0;
    }

    if (next === 'closed') {
      this.successes = 0;
      this.failures = 0;
    }

    const event: CircuitStateChangeEvent = { from: prev, to: next, failures: failuresAtTransition };
    this.safeCall(() => this.events?.onCircuitStateChange?.(event));
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= (this.config?.timeoutMs ?? 0);
  }

  /**
   * Applies {@link CircuitBreakerConfig.shouldTrip}, defaulting to counting the
   * error. A predicate that throws must not break the request path, and must not
   * silently swallow a real failure — so it falls back to counting.
   */
  private countsAsFailure(error: unknown): boolean {
    const predicate = this.config?.shouldTrip;
    if (!predicate) return true;
    try {
      return predicate(error);
    } catch {
      return true;
    }
  }

  private safeCall(fn: () => void): void {
    try {
      fn();
    } catch {
      /* never affect request path */
    }
  }
}

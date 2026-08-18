import { assertDuration, assertIntAtLeast } from './validate';

/**
 * A pluggable strategy for computing the delay before a retry attempt.
 *
 * Three built-in strategies are provided:
 * - {@link FixedRetryStrategy} — constant delay (original behaviour)
 * - {@link ExponentialRetryStrategy} — delay doubles with each attempt
 * - {@link ExponentialJitterRetryStrategy} — exponential with randomised jitter (recommended)
 *
 * @example
 * ```ts
 * client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
 * ```
 */
export interface RetryStrategy {
  /**
   * Computes the delay (ms) before attempt number `attempt` (0-based).
   * @param attempt - Zero-based retry attempt index.
   * @param error   - The error that triggered the retry.
   */
  computeDelay(attempt: number, error?: unknown): number;
}

/**
 * Fixed-delay retry strategy — every retry waits the same `delayMs`.
 *
 * Simple and predictable but can cause thundering-herd under mass failures.
 * Prefer {@link ExponentialJitterRetryStrategy} for distributed systems.
 */
export class FixedRetryStrategy implements RetryStrategy {
  constructor(private readonly delayMs: number) {
    // A negative delay makes setTimeout fire immediately: a retry storm with no
    // back-off at all.
    assertDuration(delayMs, 'FixedRetryStrategy.delayMs');
  }
  computeDelay(): number {
    return this.delayMs;
  }
}

/**
 * Exponential back-off retry strategy.
 *
 * Delay grows as `initialDelayMs × factor^attempt`, capped at `maxDelayMs`.
 * All retries from all clients attempt at the same moments — use
 * {@link ExponentialJitterRetryStrategy} to spread them out.
 */
export class ExponentialRetryStrategy implements RetryStrategy {
  constructor(
    private readonly initialDelayMs: number,
    private readonly maxDelayMs: number = 30_000,
    private readonly factor: number = 2,
  ) {
    assertDuration(initialDelayMs, 'ExponentialRetryStrategy.initialDelayMs');
    assertDuration(maxDelayMs, 'ExponentialRetryStrategy.maxDelayMs');
    assertIntAtLeast(factor, 1, 'ExponentialRetryStrategy.factor');
  }

  computeDelay(attempt: number): number {
    return Math.min(this.initialDelayMs * Math.pow(this.factor, attempt), this.maxDelayMs);
  }
}

/**
 * Exponential back-off with **full jitter** (AWS-recommended).
 *
 * Delay is a random value in `[0, min(maxDelayMs, initialDelayMs × factor^attempt)]`.
 * This distributes retries across time and prevents the thundering-herd problem
 * in distributed systems where many clients fail simultaneously.
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 *
 * @example
 * ```ts
 * // Retry up to 4 times: 0–100 ms, 0–200 ms, 0–400 ms, 0–800 ms
 * client.retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
 * ```
 */
export class ExponentialJitterRetryStrategy implements RetryStrategy {
  constructor(
    private readonly initialDelayMs: number,
    private readonly maxDelayMs: number = 30_000,
    private readonly factor: number = 2,
  ) {
    assertDuration(initialDelayMs, 'ExponentialJitterRetryStrategy.initialDelayMs');
    assertDuration(maxDelayMs, 'ExponentialJitterRetryStrategy.maxDelayMs');
    assertIntAtLeast(factor, 1, 'ExponentialJitterRetryStrategy.factor');
  }

  computeDelay(attempt: number): number {
    const cap = Math.min(this.initialDelayMs * Math.pow(this.factor, attempt), this.maxDelayMs);
    return Math.random() * cap; // full jitter
  }
}

/**
 * Retry strategy that honours the server's `Retry-After` response header
 * (sent on HTTP 429 and 503), with an exponential-jitter fallback.
 *
 * The `Retry-After` header may be:
 * - A delta-seconds value: `"30"` → wait 30 s
 * - An HTTP-date value: `"Wed, 21 Oct 2025 07:28:00 GMT"`
 *
 * The parsed delay is capped at `maxDelayMs` — an upstream asking for an hour
 * must not hold the caller for an hour.
 *
 * @example
 * ```ts
 * client.retry(5, new RetryAfterStrategy(200, 60_000))
 * ```
 */
export class RetryAfterStrategy implements RetryStrategy {
  private readonly fallback: ExponentialJitterRetryStrategy;
  private readonly maxDelayMs: number;

  constructor(initialDelayMs: number = 200, maxDelayMs: number = 60_000, factor: number = 2) {
    this.fallback = new ExponentialJitterRetryStrategy(initialDelayMs, maxDelayMs, factor);
    this.maxDelayMs = maxDelayMs;
  }

  computeDelay(attempt: number, error?: unknown): number {
    const header = this.extractRetryAfterHeader(error);
    if (header !== undefined) {
      // The header is the server's number, not ours: `Retry-After: 3600` would
      // otherwise park the call for an hour, past any maxDelayMs the caller set.
      return Math.min(this.parseRetryAfter(header), this.maxDelayMs);
    }
    return this.fallback.computeDelay(attempt);
  }

  private extractRetryAfterHeader(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const e = error as Record<string, unknown>;
    const headers = (e.response as Record<string, unknown> | undefined)?.headers;
    if (!headers || typeof headers !== 'object') return undefined;
    const value = (headers as Record<string, unknown>)['retry-after'];
    return typeof value === 'string' ? value : undefined;
  }

  private parseRetryAfter(header: string): number {
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds)) return seconds * 1000;
    const date = new Date(header);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
    return 1000;
  }
}

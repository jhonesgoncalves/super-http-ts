import { RateLimitRejectEvent, ResilienceEvents } from '../models/resilience.events';

/**
 * Configuration for the {@link RateLimiter} (sliding-window token bucket).
 *
 * @example
 * ```ts
 * // Allow 100 requests per minute, queue excess with 5 s max wait
 * client.rateLimit({ permitLimit: 100, windowMs: 60_000, queueRequests: true, queueTimeoutMs: 5_000 })
 * ```
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in each `windowMs` period.
   */
  permitLimit: number;

  /**
   * Length of the rate-limit window in milliseconds.
   * @example 60_000  // 1 minute
   */
  windowMs: number;

  /**
   * When `true`, requests that exceed the limit are queued until the next
   * window opens (or until `queueTimeoutMs` elapses).
   * When `false` (default), excess requests are rejected immediately.
   * @defaultValue false
   */
  queueRequests?: boolean;

  /**
   * Max time (ms) a queued request will wait for a token before being
   * rejected with `Error('Rate limit queue timeout')`.
   * Only relevant when `queueRequests` is `true`.
   */
  queueTimeoutMs?: number;
}

/**
 * Fixed-window token-bucket rate limiter.
 *
 * Tokens refill to `permitLimit` at the start of each window. When tokens
 * are exhausted, requests either queue (if `queueRequests` is `true`) or are
 * rejected immediately.
 *
 * @example
 * ```ts
 * const rl = new RateLimiter({ permitLimit: 100, windowMs: 60_000 });
 * await rl.acquire(); // blocks until a token is available
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private windowStart: number;
  private readonly waitQueue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    private readonly config: RateLimitConfig,
    private readonly events?: Pick<ResilienceEvents, 'onRateLimitReject'>,
  ) {
    this.tokens = config.permitLimit;
    this.windowStart = Date.now();
  }

  /**
   * Acquires a token, blocking if `queueRequests` is enabled.
   *
   * @throws `Error('Rate limit exceeded')` when no token is available and
   *   `queueRequests` is `false`.
   * @throws `Error('Rate limit queue timeout')` when a queued request waits
   *   longer than `queueTimeoutMs`.
   */
  async acquire(): Promise<void> {
    this.refillIfNeeded();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    if (!this.config.queueRequests) {
      const event: RateLimitRejectEvent = {
        permitLimit: this.config.permitLimit,
        windowMs: this.config.windowMs,
      };
      this.safeCall(() => this.events?.onRateLimitReject?.(event));
      throw new Error('Rate limit exceeded');
    }

    // Queue the request until next refill
    await new Promise<void>((resolve, reject) => {
      const timeUntilRefill = this.config.windowMs - (Date.now() - this.windowStart);
      const entry: (typeof this.waitQueue)[number] = { resolve, reject };

      if (this.config.queueTimeoutMs !== undefined) {
        entry.timer = setTimeout(() => reject(new Error('Rate limit queue timeout')), this.config.queueTimeoutMs);
      }

      this.waitQueue.push(entry);

      // Schedule a refill drain
      setTimeout(() => this.drainQueue(), timeUntilRefill + 1);
    });
  }

  /** Number of tokens remaining in the current window. */
  get available(): number {
    this.refillIfNeeded();
    return this.tokens;
  }

  private refillIfNeeded(): void {
    const elapsed = Date.now() - this.windowStart;
    if (elapsed >= this.config.windowMs) {
      this.tokens = this.config.permitLimit;
      this.windowStart = Date.now();
    }
  }

  private drainQueue(): void {
    this.refillIfNeeded();
    while (this.waitQueue.length > 0 && this.tokens > 0) {
      const next = this.waitQueue.shift()!;
      if (next.timer) clearTimeout(next.timer);
      this.tokens--;
      next.resolve();
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

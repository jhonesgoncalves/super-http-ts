import { RateLimitRejectEvent, ResilienceEvents } from '../models/resilience.events';
import { toError } from '../models/deadline';
import { assertDuration, assertIntAtLeast, assertOptional } from '../models/validate';

/**
 * Configuration for the {@link RateLimiter} (fixed-window token bucket).
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
   *
   * Defaults to {@link RateLimiter.DEFAULT_QUEUE_TIMEOUT_MS}. Pass `Infinity` to
   * wait forever — that blocks the caller indefinitely, so it has to be asked
   * for deliberately rather than being what you get by omission.
   *
   * @defaultValue 10000
   */
  queueTimeoutMs?: number;

  /**
   * Max number of requests allowed to wait for a token. Beyond this, callers are
   * rejected immediately with `Error('Rate limit queue full')`.
   *
   * An unbounded wait queue grows without limit while a window is saturated — a
   * memory leak plus latency nobody can put a number on.
   *
   * @defaultValue 1000
   */
  maxQueue?: number;
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
  /** Queue wait applied when `queueTimeoutMs` is omitted. */
  static readonly DEFAULT_QUEUE_TIMEOUT_MS = 10_000;
  /** Wait-queue ceiling applied when `maxQueue` is omitted. */
  static readonly DEFAULT_MAX_QUEUE = 1000;

  private tokens: number;
  private windowStart: number;
  private readonly waitQueue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
    onAbort?: () => void;
  }> = [];
  /**
   * One drain timer for the whole limiter. Arming one per waiter meant N timers
   * all firing at the same instant to do the same piece of work.
   */
  private drainTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly config: RateLimitConfig,
    private readonly events?: Pick<ResilienceEvents, 'onRateLimitReject'>,
  ) {
    // permitLimit: 0 rejects (or queues forever) every request; windowMs: 0
    // refills on every acquire, silently turning the limiter into a no-op.
    assertIntAtLeast(config.permitLimit, 1, 'rateLimit.permitLimit');
    assertIntAtLeast(config.windowMs, 1, 'rateLimit.windowMs');
    assertOptional(config.maxQueue, (v) => assertIntAtLeast(v, 0, 'rateLimit.maxQueue'));
    assertOptional(config.queueTimeoutMs, (v) => assertDuration(v, 'rateLimit.queueTimeoutMs', true));

    this.tokens = config.permitLimit;
    this.windowStart = Date.now();
  }

  /**
   * Acquires a token, blocking if `queueRequests` is enabled.
   *
   * @param opts.signal    - Abort the wait when this fires.
   * @param opts.maxWaitMs - Ceiling from the caller's remaining total budget.
   *   Combined with `queueTimeoutMs`; the smaller of the two wins.
   *
   * @throws `Error('Rate limit exceeded')` when no token is available and
   *   `queueRequests` is `false`.
   * @throws `Error('Rate limit queue full')` when the wait queue is at `maxQueue`.
   * @throws `Error('Rate limit queue timeout')` when a queued request waits
   *   longer than the effective timeout.
   */
  async acquire(opts: { signal?: AbortSignal; maxWaitMs?: number } = {}): Promise<void> {
    this.refillIfNeeded();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    if (!this.config.queueRequests) {
      this.emitReject();
      throw new Error('Rate limit exceeded');
    }

    if (this.waitQueue.length >= (this.config.maxQueue ?? RateLimiter.DEFAULT_MAX_QUEUE)) {
      this.emitReject();
      throw new Error('Rate limit queue full');
    }

    const configured = this.config.queueTimeoutMs ?? RateLimiter.DEFAULT_QUEUE_TIMEOUT_MS;
    const waitMs = opts.maxWaitMs === undefined ? configured : Math.min(configured, opts.maxWaitMs);

    await new Promise<void>((resolve, reject) => {
      const entry: (typeof this.waitQueue)[number] = { resolve, reject };

      const drop = (): void => {
        const idx = this.waitQueue.indexOf(entry);
        if (idx !== -1) this.waitQueue.splice(idx, 1);
        if (entry.timer) clearTimeout(entry.timer);
        if (entry.onAbort) opts.signal?.removeEventListener('abort', entry.onAbort);
      };

      if (Number.isFinite(waitMs)) {
        entry.timer = setTimeout(() => {
          // Dequeue before rejecting. Leaving a settled entry in the queue makes
          // drainQueue() spend a token resolving a promise nobody is waiting on,
          // permanently lowering effective throughput below permitLimit.
          drop();
          reject(new Error('Rate limit queue timeout'));
        }, waitMs);
      }

      if (opts.signal) {
        if (opts.signal.aborted) {
          reject(toError(opts.signal.reason));
          return;
        }
        entry.onAbort = () => {
          drop();
          reject(toError(opts.signal?.reason));
        };
        opts.signal.addEventListener('abort', entry.onAbort, { once: true });
      }

      // A granted token also tears down the abort listener.
      entry.resolve = () => {
        if (entry.onAbort) opts.signal?.removeEventListener('abort', entry.onAbort);
        resolve();
      };

      this.waitQueue.push(entry);
      this.scheduleDrain();
    });
  }

  /** Number of tokens remaining in the current window. */
  get available(): number {
    this.refillIfNeeded();
    return this.tokens;
  }

  /** Number of requests currently waiting for a token. */
  get queuedCount(): number {
    return this.waitQueue.length;
  }

  private emitReject(): void {
    const event: RateLimitRejectEvent = {
      permitLimit: this.config.permitLimit,
      windowMs: this.config.windowMs,
    };
    this.safeCall(() => this.events?.onRateLimitReject?.(event));
  }

  /** Arms a single drain for the next window boundary, if one is not already armed. */
  private scheduleDrain(): void {
    if (this.drainTimer !== undefined) return;
    const untilRefill = Math.max(0, this.config.windowMs - (Date.now() - this.windowStart));
    this.drainTimer = setTimeout(() => {
      this.drainTimer = undefined;
      this.drainQueue();
      // Callers can still be queued if the fresh window ran out of tokens too.
      if (this.waitQueue.length > 0) this.scheduleDrain();
    }, untilRefill + 1);
    this.drainTimer.unref?.();
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

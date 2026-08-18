import { BulkheadRejectEvent, ResilienceEvents } from '../models/resilience.events';
import { toError } from '../models/deadline';
import { assertDuration, assertIntAtLeast, assertOptional } from '../models/validate';

/**
 * Configuration for the {@link Bulkhead} isolation pattern.
 *
 * A bulkhead limits the number of concurrent calls to a service and optionally
 * queues excess calls. When the queue is also full, new calls are rejected
 * immediately — preventing one slow downstream from consuming all resources.
 *
 * @example
 * ```ts
 * client.bulkhead({ maxConcurrent: 10, maxQueue: 50, queueTimeoutMs: 2000 })
 * ```
 */
export interface BulkheadConfig {
  /**
   * Maximum number of in-flight (active) requests at any moment.
   * @defaultValue 10
   */
  maxConcurrent: number;

  /**
   * Maximum number of requests waiting in the queue for a slot.
   * When the queue is full, new requests are rejected immediately.
   * @defaultValue 50
   */
  maxQueue?: number;

  /**
   * How long (ms) a queued request may wait before being rejected.
   *
   * Defaults to {@link Bulkhead.DEFAULT_QUEUE_TIMEOUT_MS}. Waiting forever is a
   * blocked thread by another name — the most common way a healthy service is
   * taken down by a sick dependency — so it has to be asked for explicitly with
   * `Infinity`.
   *
   * @defaultValue 10000
   */
  queueTimeoutMs?: number;
}

/**
 * Bulkhead isolation — limits concurrent access to a resource.
 *
 * Inspired by Polly's `BulkheadPolicy` and Resilience4j's `Bulkhead`.
 * Uses an async semaphore with an optional bounded queue.
 *
 * @example
 * ```ts
 * const bh = new Bulkhead({ maxConcurrent: 10, maxQueue: 50 });
 * const result = await bh.execute(() => fetch('/api/data'));
 * ```
 */
export class Bulkhead {
  /** Queue wait applied when `queueTimeoutMs` is omitted. */
  static readonly DEFAULT_QUEUE_TIMEOUT_MS = 10_000;

  private active = 0;
  private readonly queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
    onAbort?: () => void;
  }> = [];

  constructor(
    private readonly config: BulkheadConfig,
    private readonly events?: Pick<ResilienceEvents, 'onBulkheadReject'>,
  ) {
    // maxConcurrent: 0 makes `active < maxConcurrent` false forever, so every
    // request queues and nothing ever dequeues — a total deadlock with no error.
    assertIntAtLeast(config.maxConcurrent, 1, 'bulkhead.maxConcurrent');
    assertOptional(config.maxQueue, (v) => assertIntAtLeast(v, 0, 'bulkhead.maxQueue'));
    assertOptional(config.queueTimeoutMs, (v) => assertDuration(v, 'bulkhead.queueTimeoutMs', true));
  }

  /** Current number of active (in-flight) requests. */
  get activeCount(): number {
    return this.active;
  }

  /** Current number of requests waiting in the queue. */
  get queuedCount(): number {
    return this.queue.length;
  }

  /**
   * Executes `fn` within the bulkhead.
   *
   * @throws `Error('Bulkhead queue full')` when both the active slot and the
   *   queue are at capacity.
   * @throws `Error('Bulkhead queue timeout')` when a queued request exceeds
   *   `queueTimeoutMs`.
   */
  async execute<T>(fn: () => Promise<T>, opts: { signal?: AbortSignal; maxWaitMs?: number } = {}): Promise<T> {
    const maxQueue = this.config.maxQueue ?? 50;

    if (this.active < this.config.maxConcurrent) {
      return this.run(fn);
    }

    if (this.queue.length >= maxQueue) {
      const event: BulkheadRejectEvent = { active: this.active, queued: this.queue.length };
      this.safeCall(() => this.events?.onBulkheadReject?.(event));
      throw new Error('Bulkhead queue full');
    }

    // The wait is bounded by the smaller of the configured timeout and whatever
    // is left of the caller's total budget.
    const configured = this.config.queueTimeoutMs ?? Bulkhead.DEFAULT_QUEUE_TIMEOUT_MS;
    const waitMs = opts.maxWaitMs === undefined ? configured : Math.min(configured, opts.maxWaitMs);

    // Enqueue and wait for a slot
    await new Promise<void>((resolve, reject) => {
      const entry: (typeof this.queue)[number] = { resolve, reject };

      const drop = (): void => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) this.queue.splice(idx, 1);
        if (entry.timer) clearTimeout(entry.timer);
        if (entry.onAbort) opts.signal?.removeEventListener('abort', entry.onAbort);
      };

      if (Number.isFinite(waitMs)) {
        entry.timer = setTimeout(() => {
          drop();
          reject(new Error('Bulkhead queue timeout'));
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

      // Wrap resolve so a granted slot also tears down the abort listener.
      entry.resolve = () => {
        if (entry.onAbort) opts.signal?.removeEventListener('abort', entry.onAbort);
        resolve();
      };

      this.queue.push(entry);
    });

    return this.run(fn);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.dequeue();
    }
  }

  private dequeue(): void {
    const next = this.queue.shift();
    if (!next) return;
    if (next.timer) clearTimeout(next.timer);
    next.resolve();
  }

  private safeCall(fn: () => void): void {
    try {
      fn();
    } catch {
      // event handler errors must never affect the request path
    }
  }
}

import { BulkheadRejectEvent, ResilienceEvents } from '../models/resilience.events';

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
   * `undefined` means wait indefinitely.
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
  private active = 0;
  private readonly queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    private readonly config: BulkheadConfig,
    private readonly events?: Pick<ResilienceEvents, 'onBulkheadReject'>,
  ) {}

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
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const maxQueue = this.config.maxQueue ?? 50;

    if (this.active < this.config.maxConcurrent) {
      return this.run(fn);
    }

    if (this.queue.length >= maxQueue) {
      const event: BulkheadRejectEvent = { active: this.active, queued: this.queue.length };
      this.safeCall(() => this.events?.onBulkheadReject?.(event));
      throw new Error('Bulkhead queue full');
    }

    // Enqueue and wait for a slot
    await new Promise<void>((resolve, reject) => {
      const entry: (typeof this.queue)[number] = { resolve, reject };

      if (this.config.queueTimeoutMs !== undefined) {
        entry.timer = setTimeout(() => {
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) this.queue.splice(idx, 1);
          reject(new Error('Bulkhead queue timeout'));
        }, this.config.queueTimeoutMs);
      }

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

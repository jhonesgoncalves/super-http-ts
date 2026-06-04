/**
 * Coalesces identical in-flight requests into a single network call.
 *
 * When multiple callers request the same resource simultaneously, only one
 * HTTP request is sent. All callers receive the same resolved (or rejected)
 * value. Once the request settles, the entry is removed — subsequent calls
 * start a fresh request.
 *
 * **Only idempotent requests (GET, HEAD) should be deduplicated.**
 *
 * @example
 * ```ts
 * const dedup = new RequestDedup()
 *
 * // Three simultaneous calls → one HTTP request
 * const [a, b, c] = await Promise.all([
 *   dedup.execute('GET:/users/1', () => client.get('/users/1')),
 *   dedup.execute('GET:/users/1', () => client.get('/users/1')),
 *   dedup.execute('GET:/users/1', () => client.get('/users/1')),
 * ])
 * ```
 */
export class RequestDedup {
  private readonly pending = new Map<string, Promise<unknown>>();

  /**
   * Executes `fn`, coalescing concurrent calls with the same `key`.
   *
   * @param key - A unique string identifying this request (e.g. `"GET:/users/1"`).
   * @param fn  - The async function to execute (called at most once per key at a time).
   */
  execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  /** Number of in-flight deduplicated requests. */
  get size(): number {
    return this.pending.size;
  }
}

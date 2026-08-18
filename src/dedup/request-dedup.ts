import { createHash } from 'crypto';

/**
 * Coalesces identical in-flight requests into a single network call.
 *
 * When multiple callers request the same resource simultaneously, only one
 * HTTP request is sent. All callers receive the same resolved (or rejected)
 * value. Once the request settles, the entry is removed — subsequent calls
 * start a fresh request.
 *
 * **Only idempotent requests (GET, HEAD) are deduplicated by default.**
 * Coalescing a write would hand one caller another caller's result, so the
 * eligible method set is opt-in — see {@link DedupOptions.methods}.
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
  /** How long an in-flight entry may be joined before it is considered stale. */
  static readonly DEFAULT_TTL_MS = 30_000;

  private readonly pending = new Map<string, { promise: Promise<unknown>; startedAt: number }>();

  /**
   * @param ttlMs - Age after which an in-flight entry stops being joinable.
   *   A request that never settles would otherwise pin its key forever, and every
   *   later identical call would join the same doomed promise.
   */
  constructor(private readonly ttlMs: number = RequestDedup.DEFAULT_TTL_MS) {}

  /**
   * Executes `fn`, coalescing concurrent calls with the same `key`.
   *
   * @param key - A unique string identifying this request (e.g. `"GET:/users/1"`).
   * @param fn  - The async function to execute (called at most once per key at a time).
   */
  execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing && Date.now() - existing.startedAt < this.ttlMs) {
      return existing.promise as Promise<T>;
    }

    const entry = { promise: undefined as unknown as Promise<unknown>, startedAt: Date.now() };
    entry.promise = fn().finally(() => {
      // Only clear our own entry: a stale one may already have been replaced.
      if (this.pending.get(key) === entry) this.pending.delete(key);
    });
    this.pending.set(key, entry);
    return entry.promise as Promise<T>;
  }

  /** Number of in-flight deduplicated requests. */
  get size(): number {
    return this.pending.size;
  }
}

/**
 * Methods eligible for coalescing unless overridden.
 *
 * Restricted to the two methods that carry no side effects. `PUT` and `DELETE`
 * are idempotent but not side-effect-free: coalescing two concurrent `PUT`s
 * would silently discard one writer's payload.
 */
export const DEFAULT_DEDUP_METHODS: readonly string[] = ['GET', 'HEAD'];

/** Options for {@link RequestDedup} keying, set via `client.dedup(...)`. */
export interface DedupOptions {
  /**
   * HTTP methods eligible for coalescing, upper- or lower-case.
   * @defaultValue `['GET', 'HEAD']`
   */
  methods?: string[];
}

/**
 * Builds the coalescing key for a request, or returns `undefined` when the
 * request must **not** be deduplicated.
 *
 * Returning `undefined` is the safe direction: a missed coalescing costs one
 * extra request, whereas an incorrect match returns one caller another caller's
 * response. So anything that cannot be compared byte-for-byte — a stream, a
 * `FormData`, a circular object — is refused rather than guessed at.
 */
export function buildDedupKey(parts: {
  method?: string;
  url?: string;
  params?: unknown;
  data?: unknown;
  methods: ReadonlySet<string>;
}): string | undefined {
  const method = (parts.method ?? 'GET').toUpperCase();
  if (!parts.methods.has(method)) return undefined;

  const params = fingerprint(parts.params);
  if (params === undefined) return undefined;

  // The body is part of the request's identity. Leaving it out of the key is
  // what makes two different POSTs collapse into one.
  const body = fingerprint(parts.data);
  if (body === undefined) return undefined;

  return `${method}:${parts.url ?? ''}:${params}:${body}`;
}

/**
 * Reduces a value to a stable fingerprint, or `undefined` if it cannot be
 * compared safely.
 */
function fingerprint(value: unknown): string | undefined {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'string') return hash(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Buffer.isBuffer(value)) return hash(value);
  if (value instanceof URLSearchParams) return hash(value.toString());
  if (!isPlainData(value)) return undefined;

  try {
    return hash(JSON.stringify(value));
  } catch {
    return undefined; // circular or otherwise not serialisable
  }
}

/**
 * `true` only for plain objects and arrays. Streams, `FormData`, `Blob` and
 * class instances all have their own prototype and are deliberately excluded —
 * their contents are not knowable from the value alone.
 */
function isPlainData(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hash(input: string | Buffer): string {
  return createHash('sha1').update(input).digest('hex');
}

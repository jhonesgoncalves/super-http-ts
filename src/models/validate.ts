/**
 * Configuration guards — the Fail Fast pattern applied to wiring.
 *
 * Every value checked here used to be accepted in silence and then misbehave at
 * runtime in a way that looked like anything but a config mistake:
 * `maxConcurrent: 0` deadlocked every request with no error, `permitLimit: 0`
 * rejected or hung forever, `failureThreshold: 0` left the circuit permanently
 * open, `windowMs: 0` turned the rate limiter into a no-op, and `maxSockets: 0`
 * meant *unlimited* to Node — the opposite of what it reads like.
 *
 * A bad config should fail loudly, at the call that set it, with the value it
 * received. Debugging that is a stack trace; debugging the alternative is an
 * outage.
 */

/** Prefix so a thrown message is traceable back to this library. */
const TAG = '[super-http]';

/** Requires an integer of at least `min`. */
export function assertIntAtLeast(value: unknown, min: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${TAG} ${name} must be a finite number, received ${describe(value)}`);
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(`${TAG} ${name} must be an integer, received ${value}`);
  }
  if (value < min) {
    throw new RangeError(`${TAG} ${name} must be >= ${min}, received ${value}`);
  }
}

/** Requires a non-negative, finite duration in ms. `Infinity` is allowed only if `allowInfinite`. */
export function assertDuration(value: unknown, name: string, allowInfinite = false): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${TAG} ${name} must be a number of milliseconds, received ${describe(value)}`);
  }
  if (value === Infinity) {
    if (allowInfinite) return;
    throw new RangeError(`${TAG} ${name} must be finite`);
  }
  if (value < 0) {
    throw new RangeError(`${TAG} ${name} must be >= 0, received ${value}`);
  }
}

/** Runs `assert` only when `value` is not `undefined`. */
export function assertOptional<T>(value: T | undefined, assert: (v: T) => void): void {
  if (value !== undefined) assert(value);
}

/** Fails with the allowed set listed, so the fix is in the message. */
export function assertOneOf(value: string, allowed: readonly string[], name: string): void {
  if (!allowed.includes(value)) {
    throw new RangeError(`${TAG} unknown ${name} "${value}". Expected one of: ${allowed.join(', ')}`);
  }
}

function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') return String(value);
  return typeof value;
}

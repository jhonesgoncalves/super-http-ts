/**
 * Cancellation and total-deadline primitives shared by every resilience layer.
 *
 * Without these, `timeout` bounds only a single attempt: a call could sit in the
 * rate-limiter queue, then the bulkhead queue, then burn N attempts each with a
 * full timeout, plus N backoff sleeps. Nothing subtracted the time already
 * spent, so one `await client.get()` had no upper bound the caller could state.
 *
 * A {@link RequestScope} is that upper bound. It carries one signal — the
 * caller's cancellation and the deadline folded together — plus the remaining
 * budget, so each stage can clamp its own wait instead of assuming it has the
 * whole clock to itself.
 */

/** Thrown when the total time budget for a call is exhausted. */
export class DeadlineExceededError extends Error {
  readonly code = 'DEADLINE_EXCEEDED';
  constructor(deadlineMs: number) {
    super(`Request deadline of ${deadlineMs}ms exceeded`);
    this.name = 'DeadlineExceededError';
  }
}

/** Thrown when the caller's `AbortSignal` fires. */
export class RequestAbortedError extends Error {
  readonly code = 'ABORT_ERR';
  constructor(message = 'Request aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/** `true` for errors that mean "stop", never "try again". */
export function isCancellation(error: unknown): boolean {
  if (error instanceof DeadlineExceededError || error instanceof RequestAbortedError) return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; name?: string };
  return (
    e.code === 'DEADLINE_EXCEEDED' || e.code === 'ABORT_ERR' || e.code === 'ERR_CANCELED' || e.name === 'AbortError'
  );
}

/**
 * The cancellation and timing budget for one logical request, shared by every
 * layer that might wait.
 */
export interface RequestScope {
  /** Fires when the caller aborts or the deadline elapses. */
  readonly signal?: AbortSignal;
  /** Epoch ms at which the budget runs out, if a deadline was set. */
  readonly deadlineAt?: number;
  /** Milliseconds left, or `Infinity` when no deadline was set. Never negative. */
  remaining(): number;
  /** `true` once the deadline has elapsed. */
  expired(): boolean;
  /** Releases the timer and listeners. Must run when the request settles. */
  dispose(): void;
}

const NO_SCOPE: RequestScope = {
  signal: undefined,
  deadlineAt: undefined,
  remaining: () => Infinity,
  expired: () => false,
  dispose: () => undefined,
};

/**
 * Builds the scope for one request.
 *
 * The deadline is expressed as an `AbortSignal` so it reaches axios and every
 * queue with the same mechanism the caller already uses for cancellation.
 * Listeners and the timer are torn down by {@link RequestScope.dispose} — a
 * long-lived caller signal reused across many requests must not accumulate
 * listeners.
 */
export function createRequestScope(opts: { signal?: AbortSignal; deadlineMs?: number }): RequestScope {
  const { signal: callerSignal, deadlineMs } = opts;
  const hasDeadline = typeof deadlineMs === 'number' && Number.isFinite(deadlineMs) && deadlineMs > 0;

  if (!hasDeadline && !callerSignal) return NO_SCOPE;

  // No deadline: the caller's signal already is the scope, nothing to tear down.
  if (!hasDeadline && callerSignal) {
    return {
      signal: callerSignal,
      deadlineAt: undefined,
      remaining: () => Infinity,
      expired: () => false,
      dispose: () => undefined,
    };
  }

  const deadlineAt = Date.now() + (deadlineMs as number);
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(new DeadlineExceededError(deadlineMs as number)), deadlineMs);
  // Never hold the event loop open just to enforce a deadline.
  timer.unref?.();

  let onCallerAbort: (() => void) | undefined;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      onCallerAbort = () => controller.abort(callerSignal.reason);
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  let disposed = false;
  return {
    signal: controller.signal,
    deadlineAt,
    remaining: () => Math.max(0, deadlineAt - Date.now()),
    expired: () => Date.now() >= deadlineAt,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      if (callerSignal && onCallerAbort) callerSignal.removeEventListener('abort', onCallerAbort);
    },
  };
}

/**
 * `setTimeout` that also settles when `signal` fires, and always clears its
 * timer. A plain `await sleep(ms)` in a retry loop is unabortable: the caller
 * has given up but the backoff keeps the request alive to its end.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return signal?.aborted ? Promise.reject(toError(signal.reason)) : Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(toError(signal.reason));

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(toError(signal?.reason));
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Normalises an abort `reason` into an Error. */
export function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new RequestAbortedError(typeof reason === 'string' ? reason : undefined);
}

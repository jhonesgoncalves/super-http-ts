import {
  DeadlineExceededError,
  RequestAbortedError,
  abortableSleep,
  createRequestScope,
  isCancellation,
  toError,
} from '../models/deadline';

// ─── isCancellation ──────────────────────────────────────────────────────────
describe('isCancellation', () => {
  it('recognises the library errors', () => {
    expect(isCancellation(new DeadlineExceededError(100))).toBe(true);
    expect(isCancellation(new RequestAbortedError())).toBe(true);
  });

  it("recognises axios's cancel code and the DOM abort name", () => {
    expect(isCancellation({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isCancellation({ name: 'AbortError' })).toBe(true);
    expect(isCancellation({ code: 'DEADLINE_EXCEEDED' })).toBe(true);
    expect(isCancellation({ code: 'ABORT_ERR' })).toBe(true);
  });

  it('does not treat ordinary failures as cancellation', () => {
    expect(isCancellation(new Error('boom'))).toBe(false);
    expect(isCancellation({ code: 'ECONNRESET' })).toBe(false);
    expect(isCancellation(undefined)).toBe(false);
    expect(isCancellation(null)).toBe(false);
    expect(isCancellation('cancelled')).toBe(false);
  });
});

// ─── toError ─────────────────────────────────────────────────────────────────
describe('toError', () => {
  it('passes an Error through unchanged', () => {
    const err = new Error('original');
    expect(toError(err)).toBe(err);
  });

  it('wraps a string reason', () => {
    const err = toError('gave up');
    expect(err).toBeInstanceOf(RequestAbortedError);
    expect(err.message).toBe('gave up');
  });

  it('wraps an opaque reason with a default message', () => {
    expect(toError(undefined).message).toBe('Request aborted');
    expect(toError({ weird: true }).message).toBe('Request aborted');
  });
});

// ─── createRequestScope ──────────────────────────────────────────────────────
describe('createRequestScope', () => {
  it('is inert with neither a signal nor a deadline', () => {
    const scope = createRequestScope({});
    expect(scope.signal).toBeUndefined();
    expect(scope.remaining()).toBe(Infinity);
    expect(scope.expired()).toBe(false);
    expect(() => scope.dispose()).not.toThrow();
  });

  it('passes a caller signal straight through when there is no deadline', () => {
    const controller = new AbortController();
    const scope = createRequestScope({ signal: controller.signal });
    expect(scope.signal).toBe(controller.signal);
    expect(scope.remaining()).toBe(Infinity);
    scope.dispose();
  });

  it('reports a shrinking budget when a deadline is set', () => {
    const scope = createRequestScope({ deadlineMs: 1_000 });
    expect(scope.remaining()).toBeLessThanOrEqual(1_000);
    expect(scope.remaining()).toBeGreaterThan(500);
    expect(scope.deadlineAt).toBeGreaterThan(Date.now());
    expect(scope.expired()).toBe(false);
    scope.dispose();
  });

  it('never reports a negative budget', async () => {
    const scope = createRequestScope({ deadlineMs: 1 });
    await new Promise((r) => setTimeout(r, 20));
    expect(scope.remaining()).toBe(0);
    expect(scope.expired()).toBe(true);
    scope.dispose();
  });

  it('aborts its signal with a DeadlineExceededError when the budget runs out', async () => {
    const scope = createRequestScope({ deadlineMs: 10 });
    await new Promise((r) => setTimeout(r, 40));
    expect(scope.signal?.aborted).toBe(true);
    expect(scope.signal?.reason).toBeInstanceOf(DeadlineExceededError);
    expect((scope.signal?.reason as Error).message).toMatch(/10ms/);
    scope.dispose();
  });

  it('propagates a caller abort into the composed signal', () => {
    const controller = new AbortController();
    const scope = createRequestScope({ signal: controller.signal, deadlineMs: 60_000 });
    expect(scope.signal?.aborted).toBe(false);
    controller.abort(new Error('caller changed their mind'));
    expect(scope.signal?.aborted).toBe(true);
    scope.dispose();
  });

  it('starts already aborted when the caller signal is', () => {
    const controller = new AbortController();
    controller.abort();
    const scope = createRequestScope({ signal: controller.signal, deadlineMs: 60_000 });
    expect(scope.signal?.aborted).toBe(true);
    scope.dispose();
  });

  it('detaches the caller listener on dispose', () => {
    const controller = new AbortController();
    const before =
      (controller.signal as unknown as { listenerCount?: (t: string) => number }).listenerCount?.('abort') ?? 0;
    const scope = createRequestScope({ signal: controller.signal, deadlineMs: 60_000 });
    scope.dispose();
    const after =
      (controller.signal as unknown as { listenerCount?: (t: string) => number }).listenerCount?.('abort') ?? 0;
    expect(after).toBe(before);
  });

  it('tolerates dispose being called twice', () => {
    const scope = createRequestScope({ deadlineMs: 1_000 });
    scope.dispose();
    expect(() => scope.dispose()).not.toThrow();
  });

  it('ignores a non-positive or non-finite deadline', () => {
    expect(createRequestScope({ deadlineMs: 0 }).remaining()).toBe(Infinity);
    expect(createRequestScope({ deadlineMs: -5 }).remaining()).toBe(Infinity);
    expect(createRequestScope({ deadlineMs: Infinity }).remaining()).toBe(Infinity);
  });
});

// ─── abortableSleep ──────────────────────────────────────────────────────────
describe('abortableSleep', () => {
  it('resolves after the delay', async () => {
    const t0 = Date.now();
    await abortableSleep(30);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(20);
  });

  it('resolves immediately for a non-positive delay', async () => {
    await expect(abortableSleep(0)).resolves.toBeUndefined();
    await expect(abortableSleep(-10)).resolves.toBeUndefined();
  });

  it('rejects as soon as the signal fires', async () => {
    const controller = new AbortController();
    const t0 = Date.now();
    const sleeping = abortableSleep(5_000, controller.signal);
    setTimeout(() => controller.abort(), 20);

    await expect(sleeping).rejects.toBeDefined();
    // The point of the whole thing: it does not wait out the 5 s.
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  it('rejects immediately when handed an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already gone'));
    await expect(abortableSleep(5_000, controller.signal)).rejects.toThrow('already gone');
    await expect(abortableSleep(0, controller.signal)).rejects.toThrow('already gone');
  });

  it('detaches its listener once the sleep completes', async () => {
    const controller = new AbortController();
    const count = () =>
      (controller.signal as unknown as { listenerCount?: (t: string) => number }).listenerCount?.('abort') ?? 0;

    for (let i = 0; i < 50; i++) await abortableSleep(1, controller.signal);
    expect(count()).toBeLessThan(5);
  });
});

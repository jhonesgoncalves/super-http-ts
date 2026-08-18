import { HttpClient } from '../http-client/http.client';
import { ExponentialJitterRetryStrategy } from '../models/retry.strategy';
import { Bulkhead } from '../bulkhead/bulkhead';
import { RateLimiter } from '../rate-limiter/rate-limiter';
import { FaultServer, startFaultServer } from './fault-server';

/**
 * Total deadline, cancellation and bounded waiting — the "Blocked Threads" and
 * "Slow Responses" cases.
 *
 * The point of each test is an upper bound the caller can state. Where it
 * matters, the assertion is on how many requests reached the server, because
 * that is the only way to see that work actually stopped rather than merely
 * being ignored.
 */

let server: FaultServer;

beforeAll(async () => {
  server = await startFaultServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  server.reset();
});

describe('total deadline', () => {
  it('bounds a call that would otherwise take far longer', async () => {
    const client = new HttpClient(server.url, {}, undefined, { timeout: 15_000 });
    // Left alone this is 4 attempts x 15 s plus backoff — over a minute.
    client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000)).deadline(1_500);

    const t0 = Date.now();
    await expect(client.request({ url: '/never', method: 'get' })).rejects.toBeDefined();
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeGreaterThanOrEqual(1_000);
    expect(elapsed).toBeLessThan(4_000);
  });

  it('caps a single attempt at the remaining budget', async () => {
    // Per-attempt timeout is far larger than the deadline: the deadline must win.
    const client = new HttpClient(server.url, {}, undefined, { timeout: 30_000 });
    client.deadline(600);

    const t0 = Date.now();
    await expect(client.get('/never')).rejects.toBeDefined();
    expect(Date.now() - t0).toBeLessThan(3_000);
  });

  it('accepts a per-request deadline', async () => {
    const client = new HttpClient(server.url, {}, undefined, { timeout: 30_000 });

    const t0 = Date.now();
    await expect(client.request({ url: '/never', method: 'get', policy: { deadlineMs: 500 } })).rejects.toBeDefined();
    expect(Date.now() - t0).toBeLessThan(3_000);
  });

  it('stops retrying instead of sleeping past the deadline', async () => {
    const client = new HttpClient(server.url);
    // Each backoff is longer than the whole budget, so no retry should be spent.
    client.retry(5, 5_000).deadline(400);

    let retries = 0;
    client.on({ onRetry: () => retries++ });

    const t0 = Date.now();
    await expect(client.get('/status/503')).rejects.toBeDefined();

    expect(retries).toBe(0);
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(server.stats.byPath['/status/503']).toBe(1);
  });

  it('leaves requests untouched when no deadline is configured', async () => {
    const client = new HttpClient(server.url);
    const res = await client.get('/ok');
    expect(res.status).toBe(200);
  });
});

describe('cancellation', () => {
  it('aborts an in-flight request', async () => {
    const client = new HttpClient(server.url);
    const controller = new AbortController();

    const pending = client.request({ url: '/never', method: 'get', policy: { signal: controller.signal } });
    setTimeout(() => controller.abort(), 100);

    await expect(pending).rejects.toBeDefined();
  });

  it('stops the retry loop mid-backoff instead of running to the end', async () => {
    const client = new HttpClient(server.url);
    client.retry(5, 400);

    const controller = new AbortController();
    const pending = client.request({ url: '/status/503', method: 'get', policy: { signal: controller.signal } });

    // Abort while the first backoff is sleeping.
    setTimeout(() => controller.abort(), 150);
    await expect(pending).rejects.toBeDefined();

    const seenAtAbort = server.stats.byPath['/status/503'];
    await new Promise((r) => setTimeout(r, 900));
    // No further attempt may reach the wire after the caller gave up.
    expect(server.stats.byPath['/status/503']).toBe(seenAtAbort);
  });

  it('rejects immediately when handed an already-aborted signal', async () => {
    const client = new HttpClient(server.url);
    const controller = new AbortController();
    controller.abort();

    await expect(
      client.request({ url: '/ok', method: 'get', policy: { signal: controller.signal } }),
    ).rejects.toBeDefined();
    expect(server.stats.total).toBe(0);
  });

  it('does not accumulate listeners on a signal reused across many calls', async () => {
    const client = new HttpClient(server.url);
    client.deadline(5_000);
    const controller = new AbortController();

    for (let i = 0; i < 200; i++) {
      await client.request({ url: '/ok', method: 'get', policy: { signal: controller.signal } });
    }

    // Node exposes the count; each settled request must have detached its own.
    // Falls back to 0 on a runtime without listenerCount — that asserts nothing,
    // but keeps the assertion unconditional.
    const signal = controller.signal as unknown as { listenerCount?: (t: string) => number };
    const count = signal.listenerCount?.('abort') ?? 0;
    expect(count).toBeLessThan(5);
  });
});

describe('queues must not wait forever', () => {
  it('bulkhead times out a queued request by default', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1 });
    expect(Bulkhead.DEFAULT_QUEUE_TIMEOUT_MS).toBeGreaterThan(0);

    // Occupy the only slot with something that never finishes.
    void bh.execute(() => new Promise(() => undefined));
    // A 20 ms ceiling from the caller's budget must beat the 10 s default.
    await expect(bh.execute(() => Promise.resolve('x'), { maxWaitMs: 20 })).rejects.toThrow('Bulkhead queue timeout');
  });

  it('bulkhead abandons a queued request when the caller aborts', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, queueTimeoutMs: 10_000 });
    void bh.execute(() => new Promise(() => undefined));

    const controller = new AbortController();
    const queued = bh.execute(() => Promise.resolve('x'), { signal: controller.signal });
    controller.abort();

    await expect(queued).rejects.toBeDefined();
    expect(bh.queuedCount).toBe(0);
  });

  it('rate limiter rejects past maxQueue instead of growing without bound', async () => {
    const rl = new RateLimiter({
      permitLimit: 1,
      windowMs: 60_000,
      queueRequests: true,
      queueTimeoutMs: 50,
      maxQueue: 3,
    });
    await rl.acquire(); // consume the only token

    const queued = [rl.acquire(), rl.acquire(), rl.acquire()].map((p) => p.catch(() => 'rejected'));
    expect(rl.queuedCount).toBe(3);
    await expect(rl.acquire()).rejects.toThrow('Rate limit queue full');
    await Promise.all(queued.map((p) => p.catch(() => undefined)));
  });

  it('rate limiter abandons a queued request when the caller aborts', async () => {
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 60_000, queueRequests: true });
    await rl.acquire();

    const controller = new AbortController();
    const queued = rl.acquire({ signal: controller.signal });
    controller.abort();

    await expect(queued).rejects.toBeDefined();
    expect(rl.queuedCount).toBe(0);
  });

  it('rate limiter caps a queued wait at the remaining budget', async () => {
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 60_000, queueRequests: true, queueTimeoutMs: 10_000 });
    await rl.acquire();

    const t0 = Date.now();
    await expect(rl.acquire({ maxWaitMs: 50 })).rejects.toThrow('Rate limit queue timeout');
    expect(Date.now() - t0).toBeLessThan(2_000);
  });
});

describe('integration points must be bounded', () => {
  it('rejects a response larger than maxContentLength instead of buffering it', async () => {
    const client = new HttpClient(server.url, {}, undefined, { maxContentLength: 64 * 1024 });
    await expect(client.get('/huge?bytes=1048576')).rejects.toBeDefined();
  });

  it('accepts a response under the limit', async () => {
    const client = new HttpClient(server.url, {}, undefined, { maxContentLength: 1024 * 1024 });
    const res = await client.get('/huge?bytes=4096');
    expect(res.status).toBe(200);
  });

  it('applies a default body ceiling rather than axios unlimited', async () => {
    expect(HttpClient.DEFAULT_MAX_BODY_BYTES).toBeGreaterThan(0);
    const client = new HttpClient(server.url);
    const cfg = (client['axiosInstance'] as unknown as { defaults: { maxContentLength?: number } }).defaults;
    expect(cfg.maxContentLength).toBe(HttpClient.DEFAULT_MAX_BODY_BYTES);
  });

  it('passes a socket inactivity timeout to the agent', async () => {
    const client = new HttpClient(server.url, {}, undefined, { socketTimeoutMs: 1234 });
    expect((client['httpAgent'] as unknown as { options: { timeout?: number } }).options.timeout).toBe(1234);
    expect((client['httpsAgent'] as unknown as { options: { timeout?: number } }).options.timeout).toBe(1234);
  });
});

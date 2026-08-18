import { HttpClient } from '../http-client/http.client';
import { CircuitBreaker } from '../circuit-breaker/circuit-break';
import { FaultServer, startFaultServer } from './fault-server';

/**
 * Integration coverage over real sockets — no axios mock.
 *
 * The unit suite replaces axios entirely, so it can only test orchestration
 * logic. Everything here exercises the actual `http.Agent`, real keep-alive,
 * real timeouts and real connection resets, and asserts against what the server
 * observed rather than only what the client returned.
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
  server.setOutage(false);
});

/** Deterministic failure source: every call to `/status/503` is a 503. */
const FAIL = '/status/503';

describe('real sockets', () => {
  it('completes requests and reuses keep-alive connections', async () => {
    const client = new HttpClient(server.url);
    for (let i = 0; i < 40; i++) {
      const res = await client.get('/ok');
      expect(res.status).toBe(200);
    }

    expect(server.stats.total).toBe(40);
    // Sequential requests on a keep-alive agent must not open 40 sockets.
    expect(server.stats.connections).toBeLessThan(5);
  });

  it('surfaces a mid-request connection reset as a retryable error', async () => {
    const client = new HttpClient(server.url);
    await expect(client.get('/reset')).rejects.toMatchObject({
      code: expect.stringMatching(/ECONNRESET|ECONNABORTED/) as unknown as string,
    });
  });

  it('honours the per-request timeout against a server that never answers', async () => {
    const client = new HttpClient(server.url);
    const t0 = Date.now();
    await expect(client.request({ url: '/never', method: 'get', policy: { timeout: 400 } })).rejects.toBeDefined();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(300);
    expect(elapsed).toBeLessThan(3_000);
  });

  it('keeps latency percentiles bounded over a long run', async () => {
    const client = new HttpClient(server.url);
    for (let i = 0; i < 3_000; i++) await client.get('/ok');

    const m = client.metrics();
    expect(m.success).toBe(3_000);
    expect(m.failed).toBe(0);
    // Ring buffer, not an unbounded array: memory is flat regardless of volume.
    expect((client['_metrics'] as unknown as { _latencies: Float64Array })._latencies.length).toBe(2048);
    expect(m.p99Latency).toBeGreaterThanOrEqual(m.p50Latency);
  });
});

describe('circuit breaker over real sockets', () => {
  it('does not trip on a mostly-healthy upstream', async () => {
    const trips: number[] = [];
    const client = new HttpClient(server.url);
    client.on({
      onCircuitStateChange: (e) => {
        if (e.to === 'open') trips.push(e.failures);
      },
    });
    client.circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 });

    // ~95% healthy: one real 503 for every 20 real 200s, repeated.
    for (let round = 0; round < 30; round++) {
      await client.get(FAIL).catch(() => undefined);
      for (let k = 0; k < 20; k++) await client.get('/ok');
    }

    expect(trips).toEqual([]);
    expect(client.metrics().circuitBreakerTrips).toBe(0);
  });

  it('opens after consecutive real failures and then refuses fast', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 10_000 });

    let refused = 0;
    for (let i = 0; i < 8; i++) {
      await client.get(FAIL).catch((e: Error) => {
        if (/Circuit breaker is open/.test(e.message)) refused++;
      });
    }

    expect(refused).toBe(5);
    // The refused calls must never have reached the wire — that is the point.
    expect(server.stats.byPath[FAIL]).toBe(3);
  });

  it('admits a single probe when half-open, not the whole burst', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 1, successThreshold: 5, timeoutMs: 1 });

    await client.get(FAIL).catch(() => undefined); // trip
    await new Promise((r) => setTimeout(r, 20)); // cool down into half-open
    server.reset();

    const burst = await Promise.allSettled(Array.from({ length: 25 }, () => client.get('/slow?ms=60')));

    expect(burst.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(server.stats.total).toBe(1);
  });

  it('keeps a per-request policy override off the client-level breaker', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 8, successThreshold: 1, timeoutMs: 10_000 });

    // Trip a hair-trigger override.
    await client
      .request({ url: FAIL, method: 'get', policy: { circuitBreaker: { failureThreshold: 1 } } })
      .catch(() => undefined);

    // Requests without a policy stay on threshold 8 and must still reach the wire.
    server.reset();
    for (let i = 0; i < 5; i++) await client.get(FAIL).catch(() => undefined);
    expect(server.stats.byPath[FAIL]).toBe(5);
  });
});

describe('rate limiter over real sockets', () => {
  it('recovers a full window of tokens after a queue timeout', async () => {
    const client = new HttpClient(server.url);
    client.rateLimit({ permitLimit: 10, windowMs: 300, queueRequests: true, queueTimeoutMs: 30 });

    for (let round = 0; round < 3; round++) {
      await Promise.allSettled(Array.from({ length: 25 }, () => client.get('/ok')));
      await new Promise((r) => setTimeout(r, 320));
    }

    const rl = client['rateLimiterInstance'] as unknown as { available: number };
    expect(rl.available).toBe(10);
  });
});

describe('bulkhead over real sockets', () => {
  it('caps observed server-side concurrency', async () => {
    const client = new HttpClient(server.url);
    client.bulkhead({ maxConcurrent: 4, maxQueue: 100, queueTimeoutMs: 10_000 });

    await Promise.all(Array.from({ length: 30 }, () => client.get('/slow?ms=30')));

    expect(server.stats.total).toBe(30);
    expect(server.stats.maxConcurrent).toBeLessThanOrEqual(4);
  });
});

describe('CircuitBreaker unit behaviour against a live upstream', () => {
  it('re-opens immediately when the half-open probe fails for real', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 5, successThreshold: 1, timeoutMs: 0 });
    const client = new HttpClient(server.url);

    cb['_state'] = 'half-open';
    await expect(cb.execute(() => client.get(FAIL))).rejects.toBeDefined();
    expect(cb.state).toBe('open');
  });
});

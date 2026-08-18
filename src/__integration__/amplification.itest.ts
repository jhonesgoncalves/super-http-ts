import { HttpClient } from '../http-client/http.client';
import { FaultServer, startFaultServer } from './fault-server';

/**
 * Load amplification — the "Chain Reactions" case.
 *
 * Retry multiplies the load a sick upstream sees. What matters is whether the
 * limiters still bound that multiplied load, and whether a request holds
 * capacity while it is doing nothing but sleeping. Both are only visible from
 * the server side, so every assertion here reads the server's counters.
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

describe('retry must not escape the rate limiter', () => {
  it('counts retry attempts against permitLimit', async () => {
    const client = new HttpClient(server.url);
    // 4 attempts per call x 3 calls = 12 requests wanted, but only 5 permitted.
    client.retry(3, 0).rateLimit({ permitLimit: 5, windowMs: 60_000 });

    await Promise.allSettled([client.get('/status/503'), client.get('/status/503'), client.get('/status/503')]);

    expect(server.stats.total).toBeLessThanOrEqual(5);
  });

  it('still lets a healthy call through', async () => {
    const client = new HttpClient(server.url);
    client.retry(3, 0).rateLimit({ permitLimit: 10, windowMs: 60_000 });

    const res = await client.get('/ok');
    expect(res.status).toBe(200);
    expect(server.stats.total).toBe(1);
  });
});

describe('retry must not hold a bulkhead slot while sleeping', () => {
  it('keeps slots available for other callers during backoff', async () => {
    const client = new HttpClient(server.url);
    // One slot, and a failing call that sleeps ~600 ms across two backoffs.
    // The discriminating property is ordering, not total elapsed time: with retry
    // inside the bulkhead the failing call owns the only slot for its whole
    // sequence, so every healthy call can only be served after it gives up.
    client.retry(2, 300).bulkhead({ maxConcurrent: 1, maxQueue: 50, queueTimeoutMs: 5_000 });

    const order: string[] = [];
    const failing = client.get('/status/503').catch(() => order.push('failing'));
    const healthy = Array.from({ length: 5 }, (_unused, i) => client.get('/ok').then(() => order.push(`healthy-${i}`)));

    await Promise.all([failing, ...healthy]);

    // Every healthy call must have completed before the retrying one finished.
    expect(order[order.length - 1]).toBe('failing');
    expect(order.filter((o) => o.startsWith('healthy'))).toHaveLength(5);
    expect(server.stats.maxConcurrent).toBeLessThanOrEqual(1);
  });

  it('does not retry a request the bulkhead shed', async () => {
    const client = new HttpClient(server.url);
    client.retry(3, 0).bulkhead({ maxConcurrent: 1, maxQueue: 0 });

    const results = await Promise.allSettled(Array.from({ length: 6 }, () => client.get('/slow?ms=80')));
    const shed = results.filter((r) => r.status === 'rejected');

    expect(shed.length).toBeGreaterThan(0);
    // A shed request must not come back around as retry load.
    expect(server.stats.total).toBe(results.length - shed.length);
  });

  it('does not retry a request the rate limiter shed', async () => {
    const client = new HttpClient(server.url);
    client.retry(3, 0).rateLimit({ permitLimit: 2, windowMs: 60_000 });

    await Promise.allSettled(Array.from({ length: 6 }, () => client.get('/ok')));

    expect(server.stats.total).toBe(2);
  });
});

import { HttpClient } from '../http-client/http.client';
import { FaultServer, startFaultServer } from './fault-server';

/**
 * Data-integrity guarantees, asserted against a real server.
 *
 * These are the cases where the library could return one caller another
 * caller's response, re-send a non-idempotent write, or open a circuit because
 * of a client-side mistake. Each test asserts on what the server actually
 * received, not just on what the client returned — a coalesced or re-sent
 * request is only visible from the server side.
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

describe('dedup must not coalesce distinct requests', () => {
  it('gives each concurrent POST its own response when bodies differ', async () => {
    const client = new HttpClient(server.url).dedup();

    const [a, b] = await Promise.all([
      client.request<{ echo: string }>({ url: '/echo', method: 'post', data: { id: 'AAA' } }),
      client.request<{ echo: string }>({ url: '/echo', method: 'post', data: { id: 'BBB' } }),
    ]);

    // Each caller must see its own payload reflected back.
    expect(a.data.echo).toContain('AAA');
    expect(b.data.echo).toContain('BBB');
    // And both must actually have reached the server.
    expect(server.stats.byPath['/echo']).toBe(2);
    expect(server.stats.bodies).toHaveLength(2);
  });

  it('still coalesces identical concurrent GETs', async () => {
    const client = new HttpClient(server.url).dedup();

    await Promise.all([client.get('/slow?ms=40'), client.get('/slow?ms=40'), client.get('/slow?ms=40')]);

    expect(server.stats.total).toBe(1);
  });

  it('does not coalesce non-idempotent methods by default', async () => {
    const client = new HttpClient(server.url).dedup();

    // Identical bodies: only a method-based rule can keep these apart.
    await Promise.all([
      client.request({ url: '/echo', method: 'post', data: { id: 'SAME' } }),
      client.request({ url: '/echo', method: 'post', data: { id: 'SAME' } }),
    ]);

    expect(server.stats.byPath['/echo']).toBe(2);
  });
});

describe('retry must respect method idempotency', () => {
  it('does not re-send a POST that timed out', async () => {
    const client = new HttpClient(server.url);
    client.retry(3, 0);

    await expect(
      client.request({ url: '/never', method: 'post', data: { charge: 100 }, policy: { timeout: 250 } }),
    ).rejects.toBeDefined();

    // A timeout is ambiguous: the charge may already have been applied.
    expect(server.stats.byPath['/never']).toBe(1);
  });

  it('does re-send a GET that timed out', async () => {
    const client = new HttpClient(server.url);
    client.retry(2, 0);

    await expect(client.request({ url: '/never', method: 'get', policy: { timeout: 200 } })).rejects.toBeDefined();

    expect(server.stats.byPath['/never']).toBe(3);
  });

  it('retries a POST when the connection was never established', async () => {
    // ECONNREFUSED proves the request never executed, so it is safe for any method.
    const client = new HttpClient('http://127.0.0.1:1');
    client.retry(2, 0);

    let attempts = 0;
    client.on({ onRetry: () => attempts++ });
    await expect(client.request({ url: '/x', method: 'post', data: {} })).rejects.toBeDefined();

    expect(attempts).toBe(2);
  });

  it('retries a POST on ambiguous errors when explicitly opted in', async () => {
    const client = new HttpClient(server.url);
    client.retry(2, 0, { retryNonIdempotent: true });

    await expect(
      client.request({ url: '/never', method: 'post', data: {}, policy: { timeout: 200 } }),
    ).rejects.toBeDefined();

    expect(server.stats.byPath['/never']).toBe(3);
  });

  it('treats retryOn as additive to network errors, not a replacement', async () => {
    const client = new HttpClient(server.url);
    client.retry(2, 0, { retryOn: [503] });

    let attempts = 0;
    client.on({ onRetry: () => attempts++ });
    // A reset is a network error; retryOn: [503] must not have disabled it.
    await expect(client.get('/reset')).rejects.toBeDefined();

    expect(attempts).toBe(2);
  });
});

describe('circuit breaker must distinguish client errors from upstream failure', () => {
  it('does not open on a burst of 404s', async () => {
    const trips: string[] = [];
    const client = new HttpClient(server.url);
    client.on({ onCircuitStateChange: (e) => trips.push(e.to) });
    client.circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 10_000 });

    for (let i = 0; i < 12; i++) {
      await client.get('/status/404').catch(() => undefined);
    }

    expect(trips).toEqual([]);
    // All twelve must have reached the server — none refused by an open circuit.
    expect(server.stats.byPath['/status/404']).toBe(12);
  });

  it('does not open on a burst of 401s', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 10_000 });

    for (let i = 0; i < 10; i++) {
      await client.get('/status/401').catch(() => undefined);
    }

    expect(client.metrics().circuitBreakerTrips).toBe(0);
  });

  it('still opens on a burst of 503s', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 3, successThreshold: 1, timeoutMs: 10_000 });

    let refused = 0;
    for (let i = 0; i < 6; i++) {
      await client.get('/status/503').catch((e: Error) => {
        if (/Circuit breaker is open/.test(e.message)) refused++;
      });
    }

    expect(refused).toBe(3);
  });

  it('counts a connection failure as an upstream failure', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 10_000 });

    await client.get('/reset').catch(() => undefined);
    await client.get('/reset').catch(() => undefined);

    expect(client.metrics().circuitBreakerTrips).toBe(1);
  });
});

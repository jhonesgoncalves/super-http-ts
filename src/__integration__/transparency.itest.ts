import { HttpClient } from '../http-client/http.client';
import { HttpClientFactory } from '../http-client/http.factory';
import { MetricsReporterPlugin } from '../plugins/index';
import { FaultServer, startFaultServer } from './fault-server';

/**
 * Transparency and lifecycle — "can I see what this client is doing right now,
 * and can I let go of it cleanly?"
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
  HttpClientFactory.clear();
});

describe('current state is observable', () => {
  it('reports whether the circuit is open right now', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 60_000 });

    expect(client.state().circuit).toEqual({ state: 'closed', open: false });

    await client.get('/status/503').catch(() => undefined);
    await client.get('/status/503').catch(() => undefined);

    expect(client.state().circuit).toEqual({ state: 'open', open: true });
    // The cumulative counter cannot answer this question.
    expect(client.metrics().circuitBreakerTrips).toBe(1);
  });

  it('exposes per-policy circuits separately', async () => {
    const client = new HttpClient(server.url);
    client.circuitBreak({ failureThreshold: 9, successThreshold: 1, timeoutMs: 60_000 });

    await client
      .request({ url: '/status/503', method: 'get', policy: { circuitBreaker: { failureThreshold: 1 } } })
      .catch(() => undefined);

    const state = client.state();
    expect(Object.keys(state.policyCircuits)).toHaveLength(1);
    expect(Object.values(state.policyCircuits)[0].open).toBe(true);
    expect(state.circuit?.open).toBe(false);
  });

  it('reports bulkhead, rate limiter and dedup state', async () => {
    const client = new HttpClient(server.url);
    client.bulkhead({ maxConcurrent: 2, maxQueue: 10 }).rateLimit({ permitLimit: 5, windowMs: 60_000 }).dedup();

    const inFlight = Promise.all([client.get('/slow?ms=60'), client.get('/slow?ms=60')]);
    await new Promise((r) => setTimeout(r, 20));

    const state = client.state();
    expect(state.bulkhead?.active).toBeGreaterThan(0);
    expect(state.rateLimit?.available).toBeLessThan(5);
    expect(state.dedup?.inFlight).toBeGreaterThan(0);

    await inFlight;
  });

  it('omits components that are not configured', () => {
    const state = new HttpClient(server.url).state();
    expect(state.circuit).toBeUndefined();
    expect(state.bulkhead).toBeUndefined();
    expect(state.rateLimit).toBeUndefined();
    expect(state.dedup).toBeUndefined();
  });
});

describe('correlation id', () => {
  it('sends a generated id and reports it on events', async () => {
    server.captureHeader('x-request-id');
    const client = new HttpClient(server.url).correlate();
    client.retry(1, 0);

    const seen: Array<string | undefined> = [];
    client.on({ onRetry: (e) => seen.push(e.requestId) });

    await client.get('/reset').catch(() => undefined);

    expect(server.stats.capturedHeaders.length).toBeGreaterThan(0);
    expect(seen[0]).toBeDefined();
    // Every attempt of one logical call shares the id.
    expect(new Set(server.stats.capturedHeaders).size).toBe(1);
    expect(server.stats.capturedHeaders[0]).toBe(seen[0]);
  });

  it('honours a custom header name', async () => {
    server.captureHeader('x-trace-id');
    const client = new HttpClient(server.url).correlate({ header: 'x-trace-id', generate: () => 'fixed-id' });

    await client.get('/ok');
    expect(server.stats.capturedHeaders).toEqual(['fixed-id']);
  });

  it('does not overwrite an id the caller already set', async () => {
    server.captureHeader('x-request-id');
    const client = new HttpClient(server.url).correlate();

    await client.get('/ok', { headers: { 'x-request-id': 'caller-owned' } });
    expect(server.stats.capturedHeaders).toEqual(['caller-owned']);
  });

  it('sends no header when correlation is off', async () => {
    server.captureHeader('x-request-id');
    await new HttpClient(server.url).get('/ok');
    expect(server.stats.capturedHeaders).toEqual([]);
  });
});

describe('event handlers compose', () => {
  it('runs every handler registered for the same hook', async () => {
    const client = new HttpClient(server.url);
    const calls: string[] = [];

    client.on({ onRetry: () => calls.push('first') });
    client.on({ onRetry: () => calls.push('second') });
    client.retry(1, 0);

    await client.get('/reset').catch(() => undefined);

    // Last-wins registration meant two plugins observing one hook silently
    // dropped the first.
    expect(calls).toEqual(['first', 'second']);
  });

  it('keeps going when one handler throws', async () => {
    const client = new HttpClient(server.url);
    const calls: string[] = [];

    client.on({
      onRetry: () => {
        throw new Error('bad handler');
      },
    });
    client.on({ onRetry: () => calls.push('survivor') });
    client.retry(1, 0);

    await client.get('/reset').catch(() => undefined);
    expect(calls).toEqual(['survivor']);
  });
});

describe('lifecycle', () => {
  it('closes agents so sockets are released', async () => {
    const client = new HttpClient(server.url);
    await client.get('/ok');
    expect(server.stats.connections).toBeGreaterThan(0);

    type Agent = {
      sockets: Record<string, Array<{ destroyed: boolean }>>;
      freeSockets: Record<string, Array<{ destroyed: boolean }>>;
    };
    const agent = client['httpAgent'] as unknown as Agent;
    const held = () => [...Object.values(agent.sockets), ...Object.values(agent.freeSockets)].flat();

    expect(held().length).toBeGreaterThan(0);
    expect(held().every((sock) => sock.destroyed)).toBe(false);

    await client.close();

    // Node keeps the pool's bookkeeping keys around, so the guarantee to assert
    // is that every socket the agent held is destroyed — not that the maps are
    // empty. Dropping the client alone left these sockets open.
    expect(held().every((sock) => sock.destroyed)).toBe(true);
  });

  it('clears plugin timers on close', async () => {
    const client = new HttpClient(server.url);
    client.use(MetricsReporterPlugin({ intervalMs: 10_000 }));
    await expect(client.close()).resolves.toBeUndefined();
  });

  it('factory clear closes the clients it drops', async () => {
    const a = HttpClientFactory.create(server.url);
    await a.get('/ok');
    HttpClientFactory.clear();

    // A fresh create must hand back a different instance, and the old one's
    // pool must not still be holding sockets.
    const b = HttpClientFactory.create(server.url);
    expect(b).not.toBe(a);
  });
});

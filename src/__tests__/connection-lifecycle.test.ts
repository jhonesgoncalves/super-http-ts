import { AxiosAdapter, AxiosError, InternalAxiosRequestConfig } from 'axios';
import http from 'http';
import { Socket } from 'net';
import { Readable } from 'stream';
import { HttpClient } from '../http-client/http.client';
import { HttpClientFactory } from '../http-client/http.factory';
import { createClient } from '../presets';
import { SuperHttpModule } from '../nestjs/super-http.module';
import { configurePool } from '../transport/connection-pool';

const clients: HttpClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  HttpClientFactory.clear();
});
function client(adapter: AxiosAdapter): HttpClient {
  const instance = new HttpClient('http://synthetic.invalid', { adapter, timeout: 1500 });
  clients.push(instance);
  return instance;
}
function success(config: InternalAxiosRequestConfig) {
  return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
}

it('honours Axios timeout overrides and policy precedence, including zero with a deadline', async () => {
  const timeouts: number[] = [];
  const c = client(async (config) => {
    timeouts.push(config.timeout!);
    return success(config);
  });
  await c.get('/', { timeout: 25 });
  await c.get('/', { timeout: 25, policy: { timeout: 50 } });
  await c.get('/', { timeout: 0 });
  await c.get('/', { timeout: 0, policy: { deadlineMs: 100 } });
  expect(timeouts.slice(0, 3)).toEqual([25, 50, 0]);
  expect(timeouts[3]).toBeGreaterThan(0);
  expect(timeouts[3]).toBeLessThanOrEqual(100);
});

it('reports a recovered reset as an attempt error, not a final failure', async () => {
  let attempts = 0;
  let firstAgent: unknown;
  const c = client(async (config) => {
    if (++attempts === 1) {
      firstAgent = config.httpAgent;
      throw new AxiosError('socket hang up', 'ECONNRESET', config, { _currentRequest: { reusedSocket: true } });
    }
    expect(config.httpAgent).not.toBe(firstAgent);
    return success(config);
  });
  const finalError = jest.fn(),
    attemptError = jest.fn(),
    recovered = jest.fn();
  c.retry(1, 0)
    .circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 10000 })
    .on({ onError: finalError, onAttemptError: attemptError, onRecovered: recovered });
  await expect(c.get('/')).resolves.toHaveProperty('status', 200);
  expect(attemptError).toHaveBeenCalledTimes(1);
  expect(finalError).not.toHaveBeenCalled();
  expect(recovered).toHaveBeenCalledTimes(1);
  expect(c.metrics()).toMatchObject({
    recovered: 1,
    failed: 0,
    retries: 1,
    reusedSocketResets: 1,
    circuitBreakerTrips: 0,
  });
  expect(c.state().circuit?.open).toBe(false);
});

it('counts failure of the fresh recovery and emits the final error only once', async () => {
  const c = client(async (config) => {
    throw new AxiosError('reset', 'ECONNRESET', config, { reusedSocket: config.httpAgent === c['httpAgent'] });
  });
  const finalError = jest.fn();
  c.retry(2, 0)
    .circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 10000 })
    .on({ onError: finalError });
  await expect(c.get('/')).rejects.toThrow('Circuit breaker is open');
  expect(c.metrics()).toMatchObject({ attemptErrors: 2, recovered: 0, failed: 1, circuitBreakerTrips: 1 });
  expect(finalError).toHaveBeenCalledTimes(1);
});

it('never recovers an ambiguous POST or replays a stream body by default', async () => {
  let calls = 0;
  const c = client(async (config) => {
    calls++;
    throw new AxiosError('reset', 'ECONNRESET', config, { reusedSocket: true });
  });
  c.retry(3, 0);
  await expect(c.post('/', {})).rejects.toHaveProperty('code', 'ECONNRESET');
  expect(calls).toBe(1);
  await expect(c.request({ method: 'put', url: '/', data: Readable.from('payload') })).rejects.toHaveProperty(
    'code',
    'ECONNRESET',
  );
  expect(calls).toBe(2);
});

it('honours recovery opt-out and the existing retry budget', async () => {
  let calls = 0;
  const c = client(async (config) => {
    calls++;
    throw new AxiosError('reset', 'ECONNRESET', config, { reusedSocket: true });
  });
  c.retry(1, 0, { recoverReusedSocket: false }).circuitBreak({
    failureThreshold: 1,
    successThreshold: 1,
    timeoutMs: 10000,
  });
  await expect(c.get('/')).rejects.toThrow('Circuit breaker is open');
  expect(calls).toBe(1);
});

it('does not report fallback as retry recovery', async () => {
  const c = client(async (config) => {
    throw new AxiosError('reset', 'ECONNRESET', config);
  });
  const recovered = jest.fn();
  c.retry(1, 0)
    .fallback(() => ({ data: 'fallback' }))
    .on({ onRecovered: recovered });
  await c.get('/');
  expect(recovered).not.toHaveBeenCalled();
  expect(c.metrics()).toMatchObject({ recovered: 0, fallbacks: 1 });
});

it('isolates named Nest clients without shutting down cached clients', async () => {
  const shared = createClient({ baseURL: 'http://same.invalid' });
  clients.push(shared);
  const uninstall = jest.fn();
  shared.use({ name: 'probe', install: () => undefined, uninstall });
  const definition = SuperHttpModule.forFeature([
    { name: 'A', baseURL: 'http://same.invalid' },
    { name: 'B', baseURL: 'http://same.invalid' },
  ]);
  const providers = definition.providers as Array<{ useFactory: () => HttpClient }>;
  const a = providers[0].useFactory(),
    b = providers[1].useFactory();
  clients.push(a, b);
  expect(a).not.toBe(b);
  expect(a).not.toBe(shared);
  expect(uninstall).not.toHaveBeenCalled();
  await a.onModuleDestroy();
  expect(a.isClosed).toBe(true);
  expect(b.isClosed).toBe(false);
  expect(shared.isClosed).toBe(false);
});

it('replaces closed cached clients and rejects use after close', async () => {
  const a = createClient({ baseURL: 'http://closed.invalid' });
  await a.close();
  await expect(a.get('/')).rejects.toThrow('Client is closed');
  const b = createClient({ baseURL: 'http://closed.invalid' });
  expect(b).not.toBe(a);
});

it('applies idle timeout and server hints without replacing a shorter native timeout', () => {
  const agent = configurePool(new http.Agent({ keepAlive: true, timeout: 10000 }), {
    freeSocketTimeoutMs: 4000,
    keepAliveTimeoutBufferMs: 1000,
  });
  const socket = new Socket();
  const hook = agent as unknown as { keepSocketAlive: (s: Socket) => boolean };
  Object.assign(socket, { _httpMessage: { res: { headers: { 'keep-alive': 'max=100, timeout=3' } } } });
  expect(hook.keepSocketAlive(socket)).toBe(true);
  expect(socket.timeout).toBe(2000);
  Object.assign(socket, { _httpMessage: { res: { headers: { 'keep-alive': 'timeout=1' } } } });
  expect(hook.keepSocketAlive(socket)).toBe(false);
  socket.destroy();
  agent.destroy();
});

it('retires aged sockets only when they return to the idle pool', async () => {
  const agent = new http.Agent({ keepAlive: true });
  const socket = new Socket();
  jest.spyOn(agent, 'createConnection').mockReturnValue(socket);
  configurePool(agent, { maxSocketAgeMs: 1 });
  agent.createConnection({});
  const hook = agent as unknown as { keepSocketAlive: (s: Socket) => boolean };
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(hook.keepSocketAlive(socket)).toBe(false);
  socket.destroy();
  agent.destroy();
});

it('does not bypass rate limits while recovering a reused socket', async () => {
  let calls = 0;
  const c = client(async (config) => {
    calls++;
    throw new AxiosError('reset', 'ECONNRESET', config, { reusedSocket: true });
  });
  c.retry(1, 0).rateLimit({ permitLimit: 1, windowMs: 60000 });
  await expect(c.get('/')).rejects.toThrow('Rate limit exceeded');
  expect(calls).toBe(1);
  expect(c.metrics().failed).toBe(1);
});

it('counts a reused reset normally when no retry budget remains', async () => {
  const c = client(async (config) => {
    throw new AxiosError('reset', 'ECONNRESET', config, { reusedSocket: true });
  });
  c.retry(0, 0).circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 10000 });
  await expect(c.get('/')).rejects.toHaveProperty('code', 'ECONNRESET');
  expect(c.metrics().circuitBreakerTrips).toBe(1);
  expect(c.metrics().retries).toBe(0);
});

it('does not defer health counting when backoff cannot fit the deadline', async () => {
  const c = client(async (config) => {
    throw new AxiosError('reset', 'ECONNRESET', config, { reusedSocket: true });
  });
  c.retry(1, 10000).deadline(100).circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 10000 });
  await expect(c.get('/')).rejects.toHaveProperty('code', 'ECONNRESET');
  expect(c.metrics().circuitBreakerTrips).toBe(1);
  expect(c.metrics().retries).toBe(0);
});

it('preserves explicit opt-in idempotency for POST recovery', async () => {
  let calls = 0;
  const c = client(async (config) => {
    if (++calls === 1) throw new AxiosError('reset', 'ECONNRESET', config, { reusedSocket: true });
    return success(config);
  });
  c.retry(1, 0, { retryNonIdempotent: true });
  await expect(c.post('/', { idempotent: true })).resolves.toHaveProperty('status', 200);
  expect(calls).toBe(2);
});

it('classifies unknown socket reuse separately from known new connections', async () => {
  const c = client(async (config) => {
    throw new AxiosError('reset', 'ECONNRESET', config);
  });
  await c.get('/').catch(() => undefined);
  expect(c.metrics()).toMatchObject({ unknownSocketResets: 1, newSocketResets: 0 });
});

it('validates idle retirement options before creating Agents', () => {
  expect(() => new HttpClient('http://invalid', {}, undefined, { freeSocketTimeoutMs: -1 })).toThrow();
  expect(() => new HttpClient('http://invalid', {}, undefined, { maxSocketAgeMs: 0 })).toThrow();
  expect(() => new HttpClient('http://invalid', {}, undefined, { keepAliveTimeoutBufferMs: Infinity })).toThrow();
});

import http from 'http';
import { AddressInfo, Socket } from 'net';
import { Readable } from 'stream';
import { HttpClient } from '../http-client/http.client';

let server: http.Server;
let url: string;
let connections = 0;
const sockets = new Set<Socket>();
const clients: HttpClient[] = [];
const timers = new Set<ReturnType<typeof setTimeout>>();
beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/never') return;
    if (req.url === '/reset') {
      req.socket.destroy();
      return;
    }
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=10');
    if (req.url === '/stream' || req.url === '/slow') {
      const timer = setTimeout(() => {
        timers.delete(timer);
        res.end('complete');
      }, 100);
      timers.add(timer);
      if (req.url === '/stream') res.write('start:');
      return;
    }
    res.end('ok');
    // Deliberately close after announcing keep-alive: model a peer/proxy close
    // racing with reuse, rather than destroying every request mid-handler.
    if (req.url === '/fin') req.socket.end();
  });
  server.on('connection', (socket) => {
    connections++;
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});
afterAll(async () => {
  for (const timer of timers) clearTimeout(timer);
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
function client(pool = {}): HttpClient {
  const c = new HttpClient(url, { proxy: false }, undefined, { timeout: 1000, ...pool });
  clients.push(c);
  return c;
}
it('expires free connections without aborting a longer active request', async () => {
  const c = client({ freeSocketTimeoutMs: 25, maxSockets: 1 });
  await expect(c.get('/slow')).resolves.toHaveProperty('data', 'complete');
  expect(c.state().pool.http.idle).toBe(1);
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(c.state().pool.http.idle).toBe(0);
  const before = connections;
  await c.get('/ok');
  expect(connections).toBe(before + 1);
});
it('recovers a FIN/reuse race before opening the breaker, within its retry budget', async () => {
  const c = client().retry(1, 0).circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 10000 });
  const onError = jest.fn();
  c.on({ onError });
  for (let i = 0; i < 10; i++) {
    await c.get('/fin');
    await expect(c.get('/ok')).resolves.toHaveProperty('status', 200);
  }
  expect(c.metrics().reusedSocketResets).toBeGreaterThan(0);
  expect(c.metrics().recovered).toBeGreaterThan(0);
  expect(c.metrics().retries).toBeLessThanOrEqual(10);
  expect(c.metrics().circuitBreakerTrips).toBe(0);
  expect(onError).not.toHaveBeenCalled();
});
it('preserves a streaming response obtained through a fresh-connection retry', async () => {
  const c = client().retry(1, 0);
  await c.get('/fin');
  const response = await c.get<Readable>('/stream', { responseType: 'stream' });
  let body = '';
  for await (const chunk of response.data) body += chunk.toString();
  expect(body).toBe('start:complete');
});
it('does not repeat an ambiguous POST reset', async () => {
  const c = client().retry(3, 0);
  const attemptError = jest.fn(),
    onError = jest.fn();
  c.on({ onAttemptError: attemptError, onError });
  await expect(c.post('/reset', {})).rejects.toHaveProperty('code', 'ECONNRESET');
  expect(attemptError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(c.metrics().retries).toBe(0);
});
it('honours the standard Axios timeout on the wire', async () => {
  const c = client();
  const started = Date.now();
  await expect(c.get('/never', { timeout: 40 })).rejects.toHaveProperty('code', 'ECONNABORTED');
  expect(Date.now() - started).toBeLessThan(800);
});
it('bounds timeout=0 with the total deadline', async () => {
  const c = client();
  const started = Date.now();
  await expect(c.get('/never', { timeout: 0, policy: { deadlineMs: 60 } })).rejects.toBeDefined();
  expect(Date.now() - started).toBeLessThan(800);
});

import http from 'http';
import { createClient } from '../presets';
import { HttpClient } from '../http-client/http.client';

let server: http.Server;
let client: HttpClient;
let baseURL: string;
let handle: http.RequestListener;
const timers = new Set<ReturnType<typeof setTimeout>>();
beforeEach(async () => {
  server = http.createServer((req, res) => handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;
});
afterEach(async () => {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  await client?.close();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

it('recovers a real reset with only the resilient preset', async () => {
  let calls = 0;
  handle = (req, res) => {
    if (++calls === 1) req.socket.destroy();
    else res.end('healthy');
  };
  client = createClient({ baseURL, isolated: true, preset: 'resilient-api' });
  await expect(client.get('/')).resolves.toHaveProperty('data', 'healthy');
  expect(calls).toBe(2);
  expect(client.metrics()).toMatchObject({ recovered: 1, failed: 0 });
});

it('does not duplicate a POST whose socket was reset after receipt', async () => {
  let writes = 0;
  handle = (req) => {
    writes++;
    req.socket.destroy();
  };
  client = createClient({ baseURL, isolated: true, preset: 'resilient-api' });
  await expect(client.post('/', { synthetic: true })).rejects.toHaveProperty('code', 'ECONNRESET');
  expect(writes).toBe(1);
});

it('enforces the logical deadline even when the request timeout is longer', async () => {
  let calls = 0;
  handle = (_req, res) => {
    calls++;
    timers.add(setTimeout(() => res.end('too late'), 500));
  };
  client = createClient({ baseURL, isolated: true, preset: 'resilient-api', timeout: 1000, deadlineMs: 50 });
  const start = performance.now();
  await expect(client.get('/')).rejects.toThrow();
  expect(performance.now() - start).toBeLessThan(400);
  expect(calls).toBe(1);
});

it('retires idle connections without consumer-created agents', async () => {
  const connections = new Set<unknown>();
  handle = (req, res) => {
    connections.add(req.socket);
    res.end('ok');
  };
  client = createClient({ baseURL, isolated: true, preset: 'resilient-api', pool: { freeSocketTimeoutMs: 30 } });
  await client.get('/');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await client.get('/');
  expect(connections.size).toBe(2);
});

it('bounds the wait for admission while another request is slow', async () => {
  let received!: () => void;
  const firstReceived = new Promise<void>((resolve) => {
    received = resolve;
  });
  let calls = 0;
  handle = (_req, res) => {
    calls++;
    received();
    timers.add(setTimeout(() => res.end('ok'), 400));
  };
  client = createClient({ baseURL, isolated: true, preset: 'resilient-api', capacity: 1 });
  const first = client.get('/');
  await firstReceived;
  await expect(client.get('/')).rejects.toThrow('Bulkhead queue timeout');
  await first;
  expect(calls).toBe(1);
});

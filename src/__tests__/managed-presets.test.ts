import { AxiosAdapter, AxiosError } from 'axios';
import { Agent } from 'http';
import { createClient, Preset } from '../presets';
import { HttpClient } from '../http-client/http.client';
import { HttpClientFactory } from '../http-client/http.factory';

const clients: HttpClient[] = [];
const baseURL = 'http://preset.invalid';
function make(options: Partial<Parameters<typeof createClient>[0]> = {}) {
  const client = createClient({ baseURL, isolated: true, preset: 'resilient-api', ...options });
  clients.push(client);
  return client;
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  HttpClientFactory.clear();
});

it.each<Preset>(['resilient-api', 'high-throughput', 'low-latency'])(
  '%s bounds admission and excludes business errors from the breaker',
  async (preset) => {
    let calls = 0;
    const client = make({
      preset,
      adapter: async (config) => {
        calls++;
        throw new AxiosError(
          'missing member',
          'ERR_BAD_REQUEST',
          config,
          {},
          {
            config,
            data: {},
            headers: {},
            status: 404,
            statusText: 'Not found',
          },
        );
      },
    });
    for (let n = 0; n < 12; n++) await expect(client.get('/')).rejects.toHaveProperty('response.status', 404);
    expect(calls).toBe(12);
    expect(client.state().circuit?.open).toBe(false);
    expect(client.state().bulkhead).toEqual({ active: 0, queued: 0 });
  },
);

it('derives the pool and admission budget together, and honours explicit timeout', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const adapter: AxiosAdapter = async (config) => {
    expect(config.timeout).toBe(700);
    const agent = config.httpAgent as Agent;
    expect(agent.maxSockets).toBe(1);
    expect(agent.maxFreeSockets).toBe(1);
    await gate;
    return { config, data: 'ok', headers: {}, status: 200, statusText: 'OK' };
  };
  const c = make({ capacity: 8, pool: { maxSockets: 1 }, timeout: 700, adapter });
  const active = c.get('/');
  // Allow the first dispatch to reach the adapter before filling the queue.
  await new Promise((resolve) => setImmediate(resolve));
  const queued = [c.get('/'), c.get('/')];
  const rejected = c.get('/');
  try {
    await expect(rejected).rejects.toThrow('Bulkhead queue full');
    expect(c.state().bulkhead).toEqual({ active: 1, queued: 2 });
  } finally {
    release();
  }
  await Promise.all([active, ...queued]);
  expect(c.state().circuit?.open).toBe(false);
});

it('recovers an eligible reused reset on a new connection without manual retry configuration', async () => {
  let calls = 0;
  let firstAgent: unknown;
  const c = make({
    adapter: async (config) => {
      if (++calls === 1) {
        firstAgent = config.httpAgent;
        throw new AxiosError('socket hang up', 'ECONNRESET', config, { reusedSocket: true });
      }
      expect(config.httpAgent).not.toBe(firstAgent);
      return { config, data: 'recovered', headers: {}, status: 200, statusText: 'OK' };
    },
  });
  await expect(c.get('/')).resolves.toHaveProperty('data', 'recovered');
  expect(c.metrics()).toMatchObject({ retries: 1, recovered: 1, failed: 0 });
});

it.each(['POST', 'PATCH'])('does not replay an ambiguous %s', async (method) => {
  const adapter = jest.fn(async (config) => {
    throw new AxiosError('socket hang up', 'ECONNRESET', config, { reusedSocket: true });
  });
  const c = make({ adapter });
  await expect(c.request({ method, url: '/', data: { synthetic: true } })).rejects.toHaveProperty('code', 'ECONNRESET');
  expect(adapter).toHaveBeenCalledTimes(1);
});

it('low-latency fails without retry and opens the breaker on persistent network faults', async () => {
  const adapter = jest.fn(async (config) => {
    throw new AxiosError('refused', 'ECONNREFUSED', config);
  });
  const c = make({ preset: 'low-latency', adapter });
  for (let n = 0; n < 10; n++) await expect(c.get('/')).rejects.toHaveProperty('code', 'ECONNREFUSED');
  await expect(c.get('/')).rejects.toThrow('Circuit breaker is open');
  expect(adapter).toHaveBeenCalledTimes(10);
});

it('cache hits preserve a live breaker, admission state and fluent overrides', async () => {
  const adapter = jest.fn(async (config) => {
    throw new AxiosError('refused', 'ECONNREFUSED', config);
  });
  const c = make({ isolated: false, adapter });
  c.retry(0, 0).circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 10000 });
  await expect(c.get('/')).rejects.toThrow('refused');
  const same = make({ isolated: false, capacity: 99 });
  expect(same).toBe(c);
  await expect(same.get('/')).rejects.toThrow('Circuit breaker is open');
  expect(adapter).toHaveBeenCalledTimes(1);
});

it('does not retrofit a preset onto a manually created cached client', () => {
  const manual = HttpClientFactory.create(baseURL);
  const cached = make({ isolated: false });
  expect(cached).toBe(manual);
  expect(cached.state().circuit).toBeUndefined();
  expect(cached.state().bulkhead).toBeUndefined();
});

it.each([0, -1, NaN, Infinity, 1.5])('rejects invalid capacity %s before creating a client', (capacity) => {
  expect(() => make({ capacity })).toThrow(/capacity/);
});
it.each([0, -1, NaN, Infinity, 1.5])('rejects invalid deadline %s', (deadlineMs) => {
  expect(() => make({ deadlineMs })).toThrow(/deadlineMs/);
});
it('rejects unknown profiles and capacity without a preset', () => {
  expect(() => make({ preset: 'typo' as Preset })).toThrow(/unknown HTTP preset/);
  expect(() => make({ preset: undefined, capacity: 10 })).toThrow(/requires a preset/);
});

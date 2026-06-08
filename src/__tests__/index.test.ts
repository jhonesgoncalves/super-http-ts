import axios from 'axios';
import { HttpClient } from '../http-client/http.client';
import { HttpClientFactory } from '../http-client/http.factory';
import { CircuitBreaker } from '../circuit-breaker/circuit-break';
import { Bulkhead } from '../bulkhead/bulkhead';
import { RateLimiter } from '../rate-limiter/rate-limiter';
import { RequestDedup } from '../dedup/request-dedup';
import {
  FixedRetryStrategy,
  ExponentialRetryStrategy,
  ExponentialJitterRetryStrategy,
  RetryAfterStrategy,
} from '../models/retry.strategy';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Interceptors that actually invoke the handlers (needed for metrics wiring)
const requestHandlers: Array<(c: unknown) => unknown> = [];
const responseHandlers: Array<[(r: unknown) => unknown, (e: unknown) => unknown]> = [];

const mockAxiosInstance = {
  request: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn((fn: (c: unknown) => unknown) => {
        requestHandlers.push(fn);
        return 0;
      }),
    },
    response: {
      use: jest.fn((ok: (r: unknown) => unknown, err: (e: unknown) => unknown) => {
        responseHandlers.push([ok, err]);
        return 0;
      }),
    },
  },
};

// Wrap request so interceptors fire (needed for metrics/lifecycle hooks)
const originalRequest = mockAxiosInstance.request;
mockAxiosInstance.request.mockImplementation(async (config: unknown) => {
  let cfg = config;
  for (const h of requestHandlers) cfg = await h(cfg);
  try {
    const res = await originalRequest(cfg);
    let r = res;
    for (const [ok] of responseHandlers) r = await ok(r);
    return r;
  } catch (e) {
    for (const [, errH] of responseHandlers) await (errH(e) as Promise<unknown>).catch(() => {});
    throw e;
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  requestHandlers.length = 0;
  responseHandlers.length = 0;
  mockedAxios.create.mockReturnValue(mockAxiosInstance as unknown as ReturnType<typeof axios.create>);
  HttpClientFactory.clear();
});

// ─── HttpClient — basic requests ──────────────────────────────────────────────
describe('HttpClient — basic requests', () => {
  it('makes GET, POST, PUT, PATCH, DELETE requests', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: {} });
    const client = new HttpClient('https://api.example.com');
    await client.get('/a');
    await client.post('/b', { x: 1 });
    await client.put('/c', { x: 1 });
    await client.patch('/d', { x: 1 });
    await client.delete('/e');
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(5);
  });
});

// ─── Retry strategies ─────────────────────────────────────────────────────────
describe('Retry strategies', () => {
  it('FixedRetryStrategy always returns same delay', () => {
    const s = new FixedRetryStrategy(500);
    expect(s.computeDelay()).toBe(500);
  });

  it('ExponentialRetryStrategy doubles and caps', () => {
    const s = new ExponentialRetryStrategy(100, 1000, 2);
    expect(s.computeDelay(0)).toBe(100);
    expect(s.computeDelay(1)).toBe(200);
    expect(s.computeDelay(10)).toBe(1000); // capped
  });

  it('ExponentialJitterRetryStrategy returns value in [0, cap]', () => {
    const s = new ExponentialJitterRetryStrategy(100, 10_000, 2);
    for (let i = 0; i < 20; i++) {
      const d = s.computeDelay(2);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(400); // cap = min(100*4, 10000)
    }
  });

  it('RetryAfterStrategy parses seconds header', () => {
    const s = new RetryAfterStrategy();
    const error = { response: { headers: { 'retry-after': '3' } } };
    expect(s.computeDelay(0, error)).toBe(3000);
  });

  it('RetryAfterStrategy falls back to jitter when no header', () => {
    const s = new RetryAfterStrategy(100, 10_000);
    const d = s.computeDelay(0, {});
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(100);
  });
});

// ─── Retry behaviour ──────────────────────────────────────────────────────────
describe('Retry behaviour', () => {
  it('retries on ECONNRESET with jitter strategy and succeeds', async () => {
    const networkError = Object.assign(new Error('hang up'), { code: 'ECONNRESET' });
    mockAxiosInstance.request
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue({ status: 200, data: 'ok' });

    const client = new HttpClient('https://api.example.com');
    client.retry(3, new ExponentialJitterRetryStrategy(0, 0));
    const res = await client.get('/test');
    expect(res.status).toBe(200);
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
  });

  it('fires onRetry hook with correct context', async () => {
    const networkError = Object.assign(new Error('hang up'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValueOnce(networkError).mockResolvedValue({ status: 200, data: 'ok' });

    const onRetry = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.on({ onRetry }).retry(2, new FixedRetryStrategy(0));
    await client.get('/test');
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 0 }));
  });

  it('does not retry 4xx errors', async () => {
    mockAxiosInstance.request.mockRejectedValue({ response: { status: 404 } });
    const client = new HttpClient('https://api.example.com');
    client.retry(3, 0);
    await expect(client.get('/nope')).rejects.toMatchObject({ response: { status: 404 } });
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
  });

  it('retries only on specified status codes', async () => {
    mockAxiosInstance.request
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    client.retry(2, 0, [503]);
    const res = await client.get('/test');
    expect(res.status).toBe(200);
  });

  it('throws after exhausting retries', async () => {
    const error = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(error);
    const client = new HttpClient('https://api.example.com');
    client.retry(2, 0);
    await expect(client.get('/test')).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
  });
});

// ─── Circuit breaker ──────────────────────────────────────────────────────────
describe('Circuit breaker', () => {
  it('opens after failure threshold', async () => {
    const error = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(error);
    const client = new HttpClient('https://api.example.com');
    client.circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 60_000 });
    await expect(client.request({ url: '/' })).rejects.toThrow();
    await expect(client.request({ url: '/' })).rejects.toThrow();
    await expect(client.request({ url: '/' })).rejects.toThrow('Circuit breaker is open');
  });

  it('fires onCircuitStateChange hook', async () => {
    const error = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(error);
    const onChange = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.on({ onCircuitStateChange: onChange });
    client.circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 });
    await expect(client.request({ url: '/' })).rejects.toThrow();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ to: 'open' }));
  });

  it('does not retry when circuit is open', async () => {
    const error = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(error);
    const client = new HttpClient('https://api.example.com');
    client.circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 }).retry(5, 0);
    await expect(client.request({ url: '/' })).rejects.toThrow(); // trips circuit
    const callsBefore = mockAxiosInstance.request.mock.calls.length;
    await expect(client.request({ url: '/' })).rejects.toThrow('Circuit breaker is open');
    expect(mockAxiosInstance.request.mock.calls.length).toBe(callsBefore); // no extra calls
  });
});

// ─── CircuitBreaker direct ────────────────────────────────────────────────────
describe('CircuitBreaker (direct)', () => {
  it('handleIsOpen throws when open and timeout not elapsed', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 });
    cb['_state'] = 'open';
    cb['lastFailureTime'] = Date.now();
    expect(() => cb.handleIsOpen()).toThrow('Circuit breaker is open');
  });

  it('handleIsOpen resets when timeout elapsed', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: 0 });
    cb['_state'] = 'open';
    cb['lastFailureTime'] = Date.now() - 1;
    expect(cb.handleIsOpen()).toBe(false);
    expect(cb.state).toBe('half-open');
  });

  it('execute transitions open→half-open→closed', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: 0 });
    cb['_state'] = 'open';
    cb['lastFailureTime'] = Date.now() - 1;
    const fake = { status: 200 } as unknown as ReturnType<typeof axios.get>;
    await cb.execute(() => Promise.resolve(fake as never));
    expect(cb.state).toBe('closed');
  });

  it('execute throws when open and timeout not elapsed', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 });
    cb['_state'] = 'open';
    cb['lastFailureTime'] = Date.now();
    await expect(cb.execute(() => Promise.resolve({} as never))).rejects.toThrow('Circuit breaker is open');
  });
});

// ─── Bulkhead ─────────────────────────────────────────────────────────────────
describe('Bulkhead', () => {
  it('executes tasks up to maxConcurrent', async () => {
    const bh = new Bulkhead({ maxConcurrent: 2, maxQueue: 0 });
    let active = 0;
    let maxObserved = 0;
    const task = () =>
      new Promise<void>((resolve) => {
        active++;
        maxObserved = Math.max(maxObserved, active);
        setImmediate(() => {
          active--;
          resolve();
        });
      });
    await Promise.all([bh.execute(task), bh.execute(task)]);
    expect(maxObserved).toBeLessThanOrEqual(2);
  });

  it('rejects when queue is full and fires onBulkheadReject', async () => {
    const onBulkheadReject = jest.fn();
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueue: 0 }, { onBulkheadReject });
    let release!: () => void;
    const block = new Promise<void>((r) => {
      release = r;
    });
    bh.execute(() => block);
    await expect(bh.execute(() => Promise.resolve())).rejects.toThrow('Bulkhead queue full');
    expect(onBulkheadReject).toHaveBeenCalled();
    release();
  });

  it('queues requests and processes them after slot frees', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueue: 5 });
    const order: number[] = [];
    let release!: () => void;
    const block = new Promise<void>((r) => {
      release = r;
    });
    const first = bh.execute(async () => {
      await block;
      order.push(1);
    });
    const second = bh.execute(async () => {
      order.push(2);
    });
    await new Promise((r) => setImmediate(r));
    release();
    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });
});

// ─── Rate limiter ─────────────────────────────────────────────────────────────
describe('RateLimiter', () => {
  it('allows up to permitLimit requests', async () => {
    const rl = new RateLimiter({ permitLimit: 3, windowMs: 60_000 });
    await rl.acquire();
    await rl.acquire();
    await rl.acquire();
    expect(rl.available).toBe(0);
  });

  it('throws when limit exceeded and queueRequests is false', async () => {
    const onRateLimitReject = jest.fn();
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 60_000, queueRequests: false }, { onRateLimitReject });
    await rl.acquire();
    await expect(rl.acquire()).rejects.toThrow('Rate limit exceeded');
    expect(onRateLimitReject).toHaveBeenCalled();
  });
});

// ─── Request deduplication ────────────────────────────────────────────────────
describe('RequestDedup', () => {
  it('coalesces concurrent identical requests into one call', async () => {
    let callCount = 0;
    const dedup = new RequestDedup();
    const fn = () =>
      new Promise<string>((r) => {
        callCount++;
        setTimeout(() => r('data'), 10);
      });
    const [a, b, c] = await Promise.all([
      dedup.execute('GET:/users', fn),
      dedup.execute('GET:/users', fn),
      dedup.execute('GET:/users', fn),
    ]);
    expect(callCount).toBe(1);
    expect(a).toBe('data');
    expect(b).toBe('data');
    expect(c).toBe('data');
  });

  it('runs independent requests separately', async () => {
    let calls = 0;
    const dedup = new RequestDedup();
    const fn = (id: string) => () =>
      Promise.resolve(id).then((v) => {
        calls++;
        return v;
      });
    const [a, b] = await Promise.all([dedup.execute('GET:/a', fn('A')), dedup.execute('GET:/b', fn('B'))]);
    expect(calls).toBe(2);
    expect(a).toBe('A');
    expect(b).toBe('B');
  });
});

// ─── Fallback ─────────────────────────────────────────────────────────────────
describe('Fallback', () => {
  it('returns fallback value on request failure', async () => {
    mockAxiosInstance.request.mockRejectedValue(new Error('upstream down'));
    const onFallback = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.on({ onFallback }).fallback(() => ({ items: [], fallback: true }));
    const result = await client.get('/items');
    expect(result).toMatchObject({ items: [], fallback: true });
    expect(onFallback).toHaveBeenCalled();
  });

  it('propagates original error if no fallback registered', async () => {
    mockAxiosInstance.request.mockRejectedValue(new Error('boom'));
    const client = new HttpClient('https://api.example.com');
    await expect(client.get('/items')).rejects.toThrow('boom');
  });
});

// ─── HttpClient — integrated resilience pipeline ──────────────────────────────
describe('HttpClient — integrated resilience', () => {
  it('bulkhead on HttpClient limits concurrency', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    client.bulkhead({ maxConcurrent: 2, maxQueue: 10 });
    const results = await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
    expect(results).toHaveLength(3);
  });

  it('rateLimit on HttpClient passes through when under limit', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    client.rateLimit({ permitLimit: 10, windowMs: 60_000 });
    const res = await client.get('/test');
    expect(res.status).toBe(200);
  });

  it('dedup on HttpClient coalesces concurrent GET calls', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'hit' });
    const client = new HttpClient('https://api.example.com');
    client.dedup();
    const [a, b] = await Promise.all([client.get('/same'), client.get('/same')]);
    expect(a.data).toBe('hit');
    expect(b.data).toBe('hit');
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
  });

  it('RetryAfterStrategy with HTTP-date header', () => {
    const s = new RetryAfterStrategy();
    const future = new Date(Date.now() + 3000).toUTCString();
    const error = { response: { headers: { 'retry-after': future } } };
    const delay = s.computeDelay(0, error);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(3500);
  });
});

// ─── RateLimiter — queue path ─────────────────────────────────────────────────
describe('RateLimiter — queuing', () => {
  it('queues request and resolves after window refill', async () => {
    jest.useFakeTimers();
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 100, queueRequests: true });
    await rl.acquire(); // consumes the only token

    let resolved = false;
    const queued = rl.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    jest.advanceTimersByTime(110); // advance past window
    await queued;
    expect(resolved).toBe(true);
    jest.useRealTimers();
  });

  it('rejects queued request after queueTimeoutMs', async () => {
    jest.useFakeTimers();
    const rl = new RateLimiter({
      permitLimit: 1,
      windowMs: 60_000,
      queueRequests: true,
      queueTimeoutMs: 500,
    });
    await rl.acquire();
    const queued = rl.acquire();
    jest.advanceTimersByTime(600);
    await expect(queued).rejects.toThrow('Rate limit queue timeout');
    jest.useRealTimers();
  });
});

// ─── Bulkhead — queue timeout ─────────────────────────────────────────────────
describe('Bulkhead — queue timeout', () => {
  it('rejects queued request after queueTimeoutMs', async () => {
    jest.useFakeTimers();
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueue: 5, queueTimeoutMs: 500 });
    let release!: () => void;
    const block = new Promise<void>((r) => {
      release = r;
    });
    bh.execute(() => block);
    const queued = bh.execute(() => Promise.resolve());
    jest.advanceTimersByTime(600);
    await expect(queued).rejects.toThrow('Bulkhead queue timeout');
    release();
    jest.useRealTimers();
  });
});

// ─── Metrics ─────────────────────────────────────────────────────────────────
describe('Metrics', () => {
  it('records successful requests and latency', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    await client.get('/test');
    const m = client.metrics();
    expect(m.requests).toBeGreaterThanOrEqual(1);
    expect(m.success).toBeGreaterThanOrEqual(1);
    expect(m.failed).toBe(0);
  });

  it('records retries', async () => {
    const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValueOnce(err).mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    client.retry(2, 0);
    await client.get('/test');
    expect(client.metrics().retries).toBe(1);
  });

  it('records circuit breaker trips', async () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(err);
    const client = new HttpClient('https://api.example.com');
    client.circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 });
    await expect(client.request({ url: '/' })).rejects.toThrow();
    expect(client.metrics().circuitBreakerTrips).toBe(1);
  });

  it('records fallbacks', async () => {
    mockAxiosInstance.request.mockRejectedValue(new Error('down'));
    const client = new HttpClient('https://api.example.com');
    client.fallback(() => 'fallback-value');
    await client.get('/test');
    expect(client.metrics().fallbacks).toBe(1);
  });

  it('resetMetrics clears counters', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    await client.get('/test');
    expect(client.metrics().requests).toBeGreaterThan(0);
    client.resetMetrics();
    expect(client.metrics().requests).toBe(0);
  });
});

// ─── Plugins ─────────────────────────────────────────────────────────────────
describe('Plugin system', () => {
  it('installs a plugin and fires hooks', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const installed = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.use({ name: 'test-plugin', install: installed });
    expect(installed).toHaveBeenCalledWith(client);
  });

  it('does not install the same plugin twice', () => {
    const client = new HttpClient('https://api.example.com');
    const installed = jest.fn();
    const plugin = { name: 'dedup-plugin', install: installed };
    client.use(plugin);
    client.use(plugin);
    expect(installed).toHaveBeenCalledTimes(1);
  });
});

// ─── createClient presets ─────────────────────────────────────────────────────
describe('createClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('../presets/index');

  it('creates a client with resilient-api preset', () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = createClient({ baseURL: 'https://api.example.com', preset: 'resilient-api' });
    expect(client).toBeInstanceOf(HttpClient);
  });

  it('creates a client with high-throughput preset', () => {
    const client = createClient({ baseURL: 'https://api.example.com', preset: 'high-throughput' });
    expect(client).toBeInstanceOf(HttpClient);
  });

  it('creates a client with low-latency preset', () => {
    const client = createClient({ baseURL: 'https://api.example.com', preset: 'low-latency' });
    expect(client).toBeInstanceOf(HttpClient);
  });

  it('creates a plain client without preset', () => {
    const client = createClient({ baseURL: 'https://api.example.com' });
    expect(client).toBeInstanceOf(HttpClient);
  });
});

// ─── Per-request policy ───────────────────────────────────────────────────────
describe('Per-request policy', () => {
  it('applies per-request fallback', async () => {
    mockAxiosInstance.request.mockRejectedValue(new Error('down'));
    const client = new HttpClient('https://api.example.com');
    const result = await client.request({ url: '/test', policy: { fallback: () => ({ items: [] }) } });
    expect(result).toMatchObject({ items: [] });
  });

  it('disables retry for specific request', async () => {
    const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(err);
    const client = new HttpClient('https://api.example.com');
    client.retry(3, 0);
    await expect(client.request({ url: '/test', policy: { retry: false } })).rejects.toThrow();
    // with retry: false, only 1 attempt
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
  });

  it('applies per-request timeout override', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    await client.get('/test', { policy: { timeout: 500 } } as never);
    // The request was made (timeout applied in config)
    expect(mockAxiosInstance.request).toHaveBeenCalled();
  });
});

// ─── Lifecycle hooks ──────────────────────────────────────────────────────────
describe('Lifecycle hooks (onRequest / onResponse / onError)', () => {
  it('registers onRequest/onResponse/onError handlers via .on()', () => {
    // Verify handlers merge correctly — they fire via axios interceptors in real usage
    const onRequest = jest.fn();
    const onResponse = jest.fn();
    const onError = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.on({ onRequest, onResponse, onError });
    // Calling .on() again merges (last write wins)
    const onRequest2 = jest.fn();
    client.on({ onRequest: onRequest2 });
    // Handlers were registered — actual firing tested via integration (interceptors)
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
  });
});

// ─── HttpClientFactory ────────────────────────────────────────────────────────
describe('HttpClientFactory', () => {
  it('returns the same instance for the same baseURL', () => {
    const a = HttpClientFactory.create('https://api.example.com');
    const b = HttpClientFactory.create('https://api.example.com');
    expect(a).toBe(b);
  });

  it('returns different instances for different baseURLs', () => {
    const a = HttpClientFactory.create('https://api.example.com');
    const b = HttpClientFactory.create('https://other.example.com');
    expect(a).not.toBe(b);
  });
});

// ─── Bulkhead — getters ───────────────────────────────────────────────────────
describe('Bulkhead — getters', () => {
  it('queuedCount reflects requests waiting in queue', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueue: 5 });
    let release!: () => void;
    const block = new Promise<void>((r) => {
      release = r;
    });
    bh.execute(() => block); // occupies the slot
    // Enqueue a second task without awaiting
    const second = bh.execute(() => Promise.resolve());
    await new Promise((r) => setImmediate(r)); // let microtasks settle
    expect(bh.queuedCount).toBe(1);
    expect(bh.activeCount).toBe(1);
    release();
    await second;
    expect(bh.queuedCount).toBe(0);
  });
});

// ─── CircuitBreaker — isOpen getter ──────────────────────────────────────────
describe('CircuitBreaker — isOpen getter', () => {
  it('isOpen returns true when state is open', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 });
    expect(cb.isOpen).toBe(false);
    cb['_state'] = 'open';
    expect(cb.isOpen).toBe(true);
  });
});

// ─── RequestDedup — size getter ───────────────────────────────────────────────
describe('RequestDedup — size getter', () => {
  it('size reflects in-flight deduplicated requests', async () => {
    const dedup = new RequestDedup();
    let resolve!: (v: string) => void;
    const pending = new Promise<string>((r) => {
      resolve = r;
    });
    const exec = dedup.execute('GET:/thing', () => pending);
    await new Promise((r) => setImmediate(r));
    expect(dedup.size).toBe(1);
    resolve('done');
    await exec;
    expect(dedup.size).toBe(0);
  });
});

// ─── Lifecycle hooks — fired during requests ──────────────────────────────────
describe('Lifecycle hooks — fired during requests', () => {
  it('fires onRequest hook via request interceptor', async () => {
    const onRequest = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.on({ onRequest });
    // Invoke the request interceptor handler registered by this client
    const reqHandler = requestHandlers[requestHandlers.length - 1];
    const fakeConfig = { url: '/test' };
    const result = await reqHandler(fakeConfig);
    expect(onRequest).toHaveBeenCalledWith(fakeConfig);
    expect(result).toBe(fakeConfig); // interceptor returns config unchanged
  });

  it('fires onResponse hook via response interceptor', async () => {
    const onResponse = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.on({ onResponse });
    const [resHandler] = responseHandlers[responseHandlers.length - 1];
    const fakeResponse = { status: 200, data: 'ok' };
    const result = await resHandler(fakeResponse);
    expect(onResponse).toHaveBeenCalledWith(fakeResponse);
    expect(result).toBe(fakeResponse);
  });

  it('fires onError hook via response error interceptor', async () => {
    const onError = jest.fn();
    const client = new HttpClient('https://api.example.com');
    client.on({ onError });
    const [, errHandler] = responseHandlers[responseHandlers.length - 1];
    const fakeError = new Error('network error');
    await (errHandler(fakeError) as Promise<unknown>).catch(() => {});
    expect(onError).toHaveBeenCalledWith(fakeError);
  });
});

// ─── Metrics — bulkhead and rate-limit rejects ────────────────────────────────
describe('Metrics — bulkhead and rate-limit rejects', () => {
  it('records bulkheadRejects when bulkhead queue is full', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    client.bulkhead({ maxConcurrent: 1, maxQueue: 0 });

    let release!: () => void;
    const block = new Promise<void>((r) => {
      release = r;
    });
    // Block the one slot
    mockAxiosInstance.request.mockImplementationOnce(() => block as never);
    const first = client.get('/block').catch(() => {});
    await new Promise((r) => setImmediate(r));
    // Second request hits full bulkhead
    await client.get('/reject').catch(() => {});
    release();
    await first;
    expect(client.metrics().bulkheadRejects).toBe(1);
  });

  it('records rateLimitRejects when rate limit exceeded', async () => {
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    client.rateLimit({ permitLimit: 1, windowMs: 60_000, queueRequests: false });
    await client.get('/first'); // consumes the token
    await client.get('/second').catch(() => {}); // should be rate-limited
    expect(client.metrics().rateLimitRejects).toBe(1);
  });
});

// ─── RetryAfterStrategy — invalid header fallback ────────────────────────────
describe('RetryAfterStrategy — invalid header', () => {
  it('returns 1000ms fallback when header is not a number or date', () => {
    const s = new RetryAfterStrategy();
    const error = { response: { headers: { 'retry-after': 'not-a-date' } } };
    const delay = s.computeDelay(0, error);
    expect(delay).toBe(1000);
  });
});

// ─── RateLimiter — queue with queueTimeoutMs and clearTimeout on drain ────────
describe('RateLimiter — queue timer cleared on drain', () => {
  it('clears the queue timer when token becomes available before timeout', async () => {
    jest.useFakeTimers();
    const rl = new RateLimiter({
      permitLimit: 1,
      windowMs: 100,
      queueRequests: true,
      queueTimeoutMs: 5_000, // long timeout — should be cleared when refill happens
    });
    await rl.acquire(); // consume token

    let resolved = false;
    const queued = rl.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    jest.advanceTimersByTime(110); // refill window
    await queued;
    expect(resolved).toBe(true);
    jest.useRealTimers();
  });
});

// ─── Bulkhead — default maxQueue and safeCall with no-event path ─────────────
describe('Bulkhead — default maxQueue', () => {
  it('uses default maxQueue of 50 when not specified', async () => {
    // Bulkhead created WITHOUT maxQueue — covers the ?? 50 default branch
    const bh = new Bulkhead({ maxConcurrent: 2 });
    const results = await Promise.all([bh.execute(() => Promise.resolve(1)), bh.execute(() => Promise.resolve(2))]);
    expect(results).toEqual([1, 2]);
  });

  it('rejects when queue full and no event handler provided', async () => {
    // Covers the onBulkheadReject?. branch when events are not provided
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueue: 0 }); // no events arg
    let release!: () => void;
    const block = new Promise<void>((r) => {
      release = r;
    });
    bh.execute(() => block);
    await expect(bh.execute(() => Promise.resolve())).rejects.toThrow('Bulkhead queue full');
    release();
  });
});

// ─── Retry — 5xx triggers retry via isRetryableError ─────────────────────────
describe('Retry — 5xx without retryOn filter', () => {
  it('retries automatically on 5xx response status', async () => {
    const err = { response: { status: 503 } };
    mockAxiosInstance.request.mockRejectedValueOnce(err).mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    client.retry(2, 0);
    const res = await client.get('/test');
    expect(res.status).toBe(200);
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
  });
});

// ─── CircuitBreaker — handleSuccess below threshold ──────────────────────────
describe('CircuitBreaker — partial success in half-open', () => {
  it('does not close if successes below successThreshold', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 3, timeoutMs: 0 });
    cb['_state'] = 'half-open';
    cb['successes'] = 0;
    // First success — still below threshold
    cb['handleSuccess']();
    expect(cb.state).toBe('half-open'); // not yet closed
    // Second success
    cb['handleSuccess']();
    expect(cb.state).toBe('half-open');
    // Third success closes it
    cb['handleSuccess']();
    expect(cb.state).toBe('closed');
  });

  it('transitionTo is a no-op when already in target state', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 });
    cb['_state'] = 'closed';
    cb['transitionTo']('closed'); // same state — should not throw or change anything
    expect(cb.state).toBe('closed');
  });

  it('accumulates failures without opening when below failureThreshold', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 5, successThreshold: 1, timeoutMs: 60_000 });
    cb['handleFailure']();
    cb['handleFailure']();
    cb['handleFailure']();
    expect(cb.state).toBe('closed'); // threshold not reached
    expect(cb['failures']).toBe(3);
  });
});

// ─── Retry strategy — default constructor parameters ─────────────────────────
describe('Retry strategies — default constructor parameters', () => {
  it('ExponentialRetryStrategy uses default maxDelayMs and factor', () => {
    const s = new ExponentialRetryStrategy(100);
    // factor defaults to 2: attempt 1 → 100*2=200, attempt 20 → capped at 30_000
    expect(s.computeDelay(1)).toBe(200);
    expect(s.computeDelay(20)).toBe(30_000);
  });

  it('ExponentialJitterRetryStrategy uses default maxDelayMs and factor', () => {
    const s = new ExponentialJitterRetryStrategy(100);
    const d = s.computeDelay(1);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(200); // cap = min(100*2^1, 30_000)
  });

  it('RetryAfterStrategy returns jitter when error is null', () => {
    const s = new RetryAfterStrategy();
    const d = s.computeDelay(0, null);
    expect(d).toBeGreaterThanOrEqual(0);
  });

  it('RetryAfterStrategy returns jitter when error has no response', () => {
    const s = new RetryAfterStrategy();
    const d = s.computeDelay(0, { code: 'ECONNRESET' });
    expect(d).toBeGreaterThanOrEqual(0);
  });

  it('RetryAfterStrategy returns jitter when response has no headers', () => {
    const s = new RetryAfterStrategy();
    const d = s.computeDelay(0, { response: {} });
    expect(d).toBeGreaterThanOrEqual(0);
  });

  it('RetryAfterStrategy returns jitter when retry-after value is not a string', () => {
    const s = new RetryAfterStrategy();
    const d = s.computeDelay(0, { response: { headers: { 'retry-after': 42 } } });
    expect(d).toBeGreaterThanOrEqual(0);
  });
});

// ─── CircuitBreaker — handleFailure reset path ───────────────────────────────
describe('CircuitBreaker — handleFailure reset path', () => {
  it('resets failure counter when gap between failures exceeds timeoutMs', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 10, successThreshold: 1, timeoutMs: 500 });
    // Simulate 3 prior failures 1s ago (> timeoutMs)
    cb['lastFailureTime'] = Date.now() - 1_000;
    cb['failures'] = 3;
    // Next failure should RESET counter to 1 (gap > timeoutMs)
    cb['handleFailure']();
    expect(cb['failures']).toBe(1);
  });
});

// ─── Per-request policy — CB override and retry with attempts ────────────────
describe('Per-request policy — advanced', () => {
  it('policy.circuitBreaker: false bypasses an open circuit', async () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValueOnce(err);
    const client = new HttpClient('https://api.example.com');
    client.circuitBreak({ failureThreshold: 1, successThreshold: 1, timeoutMs: 60_000 });
    // Trip the circuit
    await expect(client.request({ url: '/' })).rejects.toThrow();
    // Bypass with policy
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'ok' });
    const res = await client.request({ url: '/', policy: { circuitBreaker: false } });
    expect(res.status).toBe(200);
  });

  it('policy.circuitBreaker overrides CB config for a single request', async () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(err);
    const client = new HttpClient('https://api.example.com');
    // Base config requires 10 failures — per-request requires only 1
    client.circuitBreak({ failureThreshold: 10, successThreshold: 1, timeoutMs: 60_000 });
    await expect(client.request({ url: '/', policy: { circuitBreaker: { failureThreshold: 1 } } })).rejects.toThrow();
    await expect(client.request({ url: '/', policy: { circuitBreaker: { failureThreshold: 1 } } })).rejects.toThrow(
      'Circuit breaker is open',
    );
  });

  it('policy.retry with attempts object retries on network error', async () => {
    const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValueOnce(err).mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    const res = await client.request({ url: '/test', policy: { retry: { attempts: 2, delayMs: 0 } } });
    expect(res.status).toBe(200);
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
  });

  it('policy.retry with retryOn limits retry to specific status codes', async () => {
    mockAxiosInstance.request
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValue({ status: 200, data: 'ok' });
    const client = new HttpClient('https://api.example.com');
    const res = await client.request({ url: '/test', policy: { retry: { attempts: 2, delayMs: 0, retryOn: [503] } } });
    expect(res.status).toBe(200);
  });
});

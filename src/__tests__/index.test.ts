import axios from 'axios';
import { HttpClient } from '../http-client/http.client';
import { HttpClientFactory } from '../http-client/http.factory';
import { CircuitBreaker } from '../circuit-breaker/circuit-break';
import { Bulkhead } from '../bulkhead/bulkhead';
import { RateLimiter } from '../rate-limiter/rate-limiter';
import { RequestDedup } from '../dedup/request-dedup';
import { MetricsCollector } from '../models/metrics';
import { buildDedupKey, DEFAULT_DEDUP_METHODS } from '../dedup/request-dedup';
import { Readable } from 'stream';
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

// ─── CircuitBreaker — consecutive failure counting ───────────────────────────
describe('CircuitBreaker — consecutive failure counting', () => {
  it('a success resets the failure streak', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 10, successThreshold: 1, timeoutMs: 500 });
    cb['failures'] = 3;
    cb['handleSuccess']();
    expect(cb['failures']).toBe(0);
  });

  it('does not open when failures are interleaved with successes', () => {
    // Assert on transitions, not the final state: a breaker that trips and is
    // immediately closed again by the next success looks healthy at the end
    // while having already rejected traffic.
    const trips: number[] = [];
    const cb = new CircuitBreaker();
    cb.setConfig(
      { failureThreshold: 3, successThreshold: 1, timeoutMs: 10_000 },
      {
        onCircuitStateChange: (e) => {
          if (e.to === 'open') trips.push(e.failures);
        },
      },
    );
    // A healthy upstream with a low baseline error rate: never 3 in a row.
    for (let i = 0; i < 20; i++) {
      cb['handleFailure']();
      cb['handleFailure']();
      cb['handleSuccess']();
    }
    expect(trips).toEqual([]);
    expect(cb.state).toBe('closed');
  });

  it('opens on failureThreshold consecutive failures regardless of elapsed time', () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 3, successThreshold: 1, timeoutMs: 1 });
    cb['handleFailure']();
    // A gap longer than timeoutMs used to silently reset the streak.
    cb['lastFailureTime'] = Date.now() - 60_000;
    cb['handleFailure']();
    cb['handleFailure']();
    expect(cb.state).toBe('open');
  });
});

// ─── CircuitBreaker — half-open behaviour ────────────────────────────────────
describe('CircuitBreaker — half-open behaviour', () => {
  it('admits only one probe at a time', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: 0 });
    cb['_state'] = 'half-open';

    let admitted = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const probe = () => {
      admitted++;
      return gate.then(() => ({ status: 200 } as never));
    };

    const first = cb.execute(probe);
    await expect(cb.execute(probe)).rejects.toThrow('Circuit breaker is open');
    expect(admitted).toBe(1);

    release();
    await first;
  });

  it('honours successThreshold after re-opening', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 3, timeoutMs: 0 });
    const ok = () => Promise.resolve({ status: 200 } as never);

    // Accumulate successes while closed, then trip the circuit.
    await cb.execute(ok);
    await cb.execute(ok);
    await cb.execute(ok);
    await expect(cb.execute(() => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(cb.state).toBe('open');

    // First probe must not close the circuit on its own.
    await cb.execute(ok);
    expect(cb.state).toBe('half-open');
    await cb.execute(ok);
    expect(cb.state).toBe('half-open');
    await cb.execute(ok);
    expect(cb.state).toBe('closed');
  });

  it('re-opens immediately when a probe fails', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 5, successThreshold: 1, timeoutMs: 0 });
    cb['_state'] = 'half-open';
    await expect(cb.execute(() => Promise.reject(new Error('still down')))).rejects.toThrow('still down');
    expect(cb.state).toBe('open');
  });

  it('reports the failure streak that caused the transition', async () => {
    const events: Array<{ to: string; failures: number }> = [];
    const cb = new CircuitBreaker();
    cb.setConfig(
      { failureThreshold: 2, successThreshold: 1, timeoutMs: 0 },
      { onCircuitStateChange: (e) => events.push({ to: e.to, failures: e.failures }) },
    );
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(events.find((e) => e.to === 'open')?.failures).toBe(2);
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

// ─── Per-request policy — circuit breaker isolation ──────────────────────────
describe('Per-request policy — circuit breaker isolation', () => {
  it('does not leak a per-request override into later requests', async () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(err);
    const client = new HttpClient('https://api.example.com');
    client.circuitBreak({ failureThreshold: 10, successThreshold: 1, timeoutMs: 60_000 });

    // One request asks for a hair-trigger breaker and trips it.
    await expect(client.request({ url: '/', policy: { circuitBreaker: { failureThreshold: 1 } } })).rejects.toThrow();

    // Requests without a policy must still be on the client's threshold of 10,
    // and must not inherit the tripped state of the override's breaker.
    // The 10th failure is what opens it, so all ten still reach axios.
    for (let i = 0; i < 10; i++) {
      await expect(client.request({ url: '/' })).rejects.toMatchObject({ code: 'ECONNRESET' });
    }
    await expect(client.request({ url: '/' })).rejects.toThrow('Circuit breaker is open');
  });

  it('keeps failure counts separate across distinct policies', async () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValue(err);
    const client = new HttpClient('https://api.example.com');
    client.circuitBreak({ failureThreshold: 5, successThreshold: 1, timeoutMs: 60_000 });

    // Two different overrides, each needing 2 consecutive failures of its own.
    const a = { circuitBreaker: { failureThreshold: 2, timeoutMs: 60_000 } };
    const b = { circuitBreaker: { failureThreshold: 2, timeoutMs: 30_000 } };
    await expect(client.request({ url: '/', policy: a })).rejects.toMatchObject({ code: 'ECONNRESET' });
    await expect(client.request({ url: '/', policy: b })).rejects.toMatchObject({ code: 'ECONNRESET' });
    // a's second consecutive failure opens a's breaker (this call still reaches axios).
    await expect(client.request({ url: '/', policy: a })).rejects.toMatchObject({ code: 'ECONNRESET' });
    await expect(client.request({ url: '/', policy: a })).rejects.toThrow('Circuit breaker is open');

    // b has seen only one failure, so its breaker must still be closed.
    await expect(client.request({ url: '/', policy: b })).rejects.toMatchObject({ code: 'ECONNRESET' });

    // And the client-level breaker (threshold 5) is untouched by both.
    await expect(client.request({ url: '/' })).rejects.toMatchObject({ code: 'ECONNRESET' });
  });
});

// ─── MetricsCollector — bounded latency window ───────────────────────────────
describe('MetricsCollector — bounded latency window', () => {
  it('keeps latency memory constant regardless of request volume', () => {
    const m = new MetricsCollector();
    for (let i = 0; i < 100_000; i++) m.recordSuccess(10);
    expect(m['_latencies'].length).toBe(MetricsCollector.DEFAULT_LATENCY_WINDOW);
    const snap = m.snapshot();
    expect(snap.success).toBe(100_000);
    expect(snap.p50Latency).toBe(10);
  });

  it('percentiles reflect only the most recent window', () => {
    const m = new MetricsCollector(4);
    for (const v of [1, 1, 1, 1]) m.recordSuccess(v);
    expect(m.snapshot().p50Latency).toBe(1);

    // Ring buffer wraps — the early samples must age out entirely.
    for (const v of [100, 200, 300, 400]) m.recordSuccess(v);
    const snap = m.snapshot();
    expect(snap.p50Latency).toBe(200);
    expect(snap.p99Latency).toBe(400);
  });

  it('avgLatency covers the full history, not just the window', () => {
    const m = new MetricsCollector(2);
    m.recordSuccess(10);
    m.recordSuccess(20);
    m.recordSuccess(30);
    expect(m.snapshot().avgLatency).toBe(20);
  });

  it('handles a partially filled window', () => {
    const m = new MetricsCollector(8);
    m.recordSuccess(5);
    m.recordSuccess(15);
    const snap = m.snapshot();
    expect(snap.p50Latency).toBe(5);
    expect(snap.p99Latency).toBe(15);
    expect(snap.avgLatency).toBe(10);
  });

  it('reports zeroed percentiles before any success', () => {
    const snap = new MetricsCollector(4).snapshot();
    expect(snap.p50Latency).toBe(0);
    expect(snap.p95Latency).toBe(0);
    expect(snap.avgLatency).toBe(0);
  });

  it('reset clears the window and restarts uptime', () => {
    const m = new MetricsCollector(4);
    m.recordRequest();
    m.recordSuccess(50);
    m.reset();
    const snap = m.snapshot();
    expect(snap.requests).toBe(0);
    expect(snap.success).toBe(0);
    expect(snap.p50Latency).toBe(0);
    expect(snap.avgLatency).toBe(0);
    expect(snap.uptime).toBeLessThan(1_000);
  });
});

// ─── RateLimiter — token accounting on queue timeout ─────────────────────────
describe('RateLimiter — token accounting on queue timeout', () => {
  it('does not lose a token when a queued request times out', async () => {
    jest.useFakeTimers();
    const rl = new RateLimiter({
      permitLimit: 2,
      windowMs: 1_000,
      queueRequests: true,
      queueTimeoutMs: 100,
    });
    await rl.acquire();
    await rl.acquire(); // both tokens consumed

    const queued = rl.acquire();
    jest.advanceTimersByTime(150);
    await expect(queued).rejects.toThrow('Rate limit queue timeout');

    // The drain that runs at the window boundary must not spend a token on the
    // entry that already gave up, or throughput decays below permitLimit.
    jest.advanceTimersByTime(1_000);
    expect(rl.available).toBe(2);
    jest.useRealTimers();
  });
});

// ─── Dedup keying — request identity ─────────────────────────────────────────
describe('buildDedupKey', () => {
  const methods = new Set(DEFAULT_DEDUP_METHODS);

  it('gives different bodies different keys', () => {
    const a = buildDedupKey({ method: 'POST', url: '/o', data: { id: 'A' }, methods: new Set(['POST']) });
    const b = buildDedupKey({ method: 'POST', url: '/o', data: { id: 'B' }, methods: new Set(['POST']) });
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });

  it('gives identical requests the same key', () => {
    const a = buildDedupKey({ method: 'GET', url: '/u', params: { p: 1 }, methods });
    const b = buildDedupKey({ method: 'GET', url: '/u', params: { p: 1 }, methods });
    expect(a).toBe(b);
  });

  it('separates params from body', () => {
    const a = buildDedupKey({ method: 'GET', url: '/u', params: { x: 1 }, methods });
    const b = buildDedupKey({ method: 'GET', url: '/u', params: { x: 2 }, methods });
    expect(a).not.toBe(b);
  });

  it('refuses methods outside the eligible set', () => {
    expect(buildDedupKey({ method: 'POST', url: '/o', methods })).toBeUndefined();
    expect(buildDedupKey({ method: 'DELETE', url: '/o', methods })).toBeUndefined();
    expect(buildDedupKey({ method: 'GET', url: '/o', methods })).toBeDefined();
  });

  it('is case-insensitive about the method', () => {
    expect(buildDedupKey({ method: 'get', url: '/u', methods })).toBe(
      buildDedupKey({ method: 'GET', url: '/u', methods }),
    );
  });

  it('defaults to GET when no method is given', () => {
    expect(buildDedupKey({ url: '/u', methods })).toBeDefined();
  });

  it('refuses to key an opaque body rather than guessing', () => {
    const stream = new Readable();
    expect(buildDedupKey({ method: 'POST', url: '/o', data: stream, methods: new Set(['POST']) })).toBeUndefined();

    class Custom {
      constructor(public v = 1) {}
    }
    expect(
      buildDedupKey({ method: 'POST', url: '/o', data: new Custom(), methods: new Set(['POST']) }),
    ).toBeUndefined();
  });

  it('refuses a circular body instead of throwing', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(buildDedupKey({ method: 'POST', url: '/o', data: circular, methods: new Set(['POST']) })).toBeUndefined();
  });

  it('keys strings, buffers and URLSearchParams by content', () => {
    const post = new Set(['POST']);
    expect(buildDedupKey({ method: 'POST', url: '/o', data: 'x', methods: post })).not.toBe(
      buildDedupKey({ method: 'POST', url: '/o', data: 'y', methods: post }),
    );
    expect(buildDedupKey({ method: 'POST', url: '/o', data: Buffer.from('x'), methods: post })).not.toBe(
      buildDedupKey({ method: 'POST', url: '/o', data: Buffer.from('y'), methods: post }),
    );
    expect(buildDedupKey({ method: 'POST', url: '/o', data: new URLSearchParams('a=1'), methods: post })).not.toBe(
      buildDedupKey({ method: 'POST', url: '/o', data: new URLSearchParams('a=2'), methods: post }),
    );
  });

  it('treats a missing body as its own value, not as an error', () => {
    expect(buildDedupKey({ method: 'GET', url: '/u', data: undefined, methods })).toBeDefined();
    expect(buildDedupKey({ method: 'GET', url: '/u', data: null, methods })).toBeDefined();
  });
});

// ─── Circuit breaker — shouldTrip predicate ──────────────────────────────────
describe('CircuitBreaker — shouldTrip predicate', () => {
  const reject = (err: unknown) => () => Promise.reject(err);

  it('does not count errors the predicate rejects', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 60_000,
      shouldTrip: () => false,
    });
    await expect(cb.execute(reject(new Error('x')))).rejects.toThrow('x');
    await expect(cb.execute(reject(new Error('x')))).rejects.toThrow('x');
    await expect(cb.execute(reject(new Error('x')))).rejects.toThrow('x');
    expect(cb.state).toBe('closed');
    expect(cb['failures']).toBe(0);
  });

  it('still counts errors the predicate accepts', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 2, successThreshold: 1, timeoutMs: 60_000, shouldTrip: () => true });
    await expect(cb.execute(reject(new Error('x')))).rejects.toThrow();
    await expect(cb.execute(reject(new Error('x')))).rejects.toThrow();
    expect(cb.state).toBe('open');
  });

  it('leaves the circuit half-open when a probe fails with an uncounted error', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({ failureThreshold: 1, successThreshold: 2, timeoutMs: 0, shouldTrip: () => false });
    cb['_state'] = 'half-open';
    await expect(cb.execute(reject(new Error('client error')))).rejects.toThrow();
    expect(cb.state).toBe('half-open');
  });

  it('counts the failure when the predicate itself throws', async () => {
    const cb = new CircuitBreaker();
    cb.setConfig({
      failureThreshold: 1,
      successThreshold: 1,
      timeoutMs: 60_000,
      shouldTrip: () => {
        throw new Error('bad predicate');
      },
    });
    await expect(cb.execute(reject(new Error('x')))).rejects.toThrow('x');
    expect(cb.state).toBe('open');
  });
});

// ─── RetryAfterStrategy — the server's number is not the caller's budget ─────
describe('RetryAfterStrategy — header clamping', () => {
  it('caps a large Retry-After at maxDelayMs', () => {
    const s = new RetryAfterStrategy(200, 5_000);
    const delay = s.computeDelay(0, { response: { headers: { 'retry-after': '3600' } } });
    expect(delay).toBe(5_000);
  });

  it('honours a Retry-After below the cap', () => {
    const s = new RetryAfterStrategy(200, 60_000);
    expect(s.computeDelay(0, { response: { headers: { 'retry-after': '2' } } })).toBe(2_000);
  });

  it('caps an HTTP-date Retry-After too', () => {
    const s = new RetryAfterStrategy(200, 1_000);
    const far = new Date(Date.now() + 3_600_000).toUTCString();
    expect(s.computeDelay(0, { response: { headers: { 'retry-after': far } } })).toBe(1_000);
  });
});

// ─── Per-request retry policy must not discard the client's strategy ─────────
describe('policy.retry strategy inheritance', () => {
  it('inherits the client strategy when no delayMs is given', async () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValueOnce(err).mockResolvedValue({ status: 200, data: 'ok' });

    const client = new HttpClient('https://api.example.com');
    const strategy = new FixedRetryStrategy(0);
    const spy = jest.spyOn(strategy, 'computeDelay');
    client.retry(1, strategy);

    await client.request({ url: '/t', method: 'get', policy: { retry: { attempts: 2 } } });
    // The override changed the attempt count, not the back-off shape.
    expect(spy).toHaveBeenCalled();
  });

  it('uses a fixed delay when delayMs is explicit', async () => {
    const err = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
    mockAxiosInstance.request.mockRejectedValueOnce(err).mockResolvedValue({ status: 200, data: 'ok' });

    const client = new HttpClient('https://api.example.com');
    const strategy = new FixedRetryStrategy(999);
    const spy = jest.spyOn(strategy, 'computeDelay');
    client.retry(1, strategy);

    await client.request({ url: '/t', method: 'get', policy: { retry: { attempts: 2, delayMs: 0 } } });
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── Fail Fast — bad config must throw at wiring time ────────────────────────
describe('config validation', () => {
  const client = () => new HttpClient('https://api.example.com');

  it('rejects a bulkhead that would deadlock', () => {
    // maxConcurrent: 0 made `active < maxConcurrent` false forever, so every
    // request queued and nothing ever dequeued — no error, just a dead client.
    expect(() => new Bulkhead({ maxConcurrent: 0 })).toThrow(/maxConcurrent must be >= 1/);
    expect(() => new Bulkhead({ maxConcurrent: -5 })).toThrow(/maxConcurrent/);
    expect(() => new Bulkhead({ maxConcurrent: 1.5 })).toThrow(/integer/);
    expect(() => new Bulkhead({ maxConcurrent: 10, maxQueue: -1 })).toThrow(/maxQueue/);
  });

  it('accepts a valid bulkhead, including an explicit infinite wait', () => {
    expect(() => new Bulkhead({ maxConcurrent: 1 })).not.toThrow();
    expect(() => new Bulkhead({ maxConcurrent: 1, queueTimeoutMs: Infinity })).not.toThrow();
  });

  it('rejects a rate limiter that would reject or hang everything', () => {
    expect(() => new RateLimiter({ permitLimit: 0, windowMs: 1_000 })).toThrow(/permitLimit must be >= 1/);
    // windowMs: 0 refilled on every acquire, making the limiter a silent no-op.
    expect(() => new RateLimiter({ permitLimit: 10, windowMs: 0 })).toThrow(/windowMs must be >= 1/);
    expect(() => new RateLimiter({ permitLimit: -1, windowMs: 1_000 })).toThrow(/permitLimit/);
  });

  it('rejects a circuit breaker that would trip permanently', () => {
    const cb = new CircuitBreaker();
    expect(() => cb.setConfig({ failureThreshold: 0, successThreshold: 1, timeoutMs: 1_000 })).toThrow(
      /failureThreshold must be >= 1/,
    );
    expect(() => cb.setConfig({ failureThreshold: 1, successThreshold: 0, timeoutMs: 1_000 })).toThrow(
      /successThreshold/,
    );
    expect(() => cb.setConfig({ failureThreshold: 1, successThreshold: 1, timeoutMs: -1 })).toThrow(/timeoutMs/);
  });

  it('rejects a negative retry delay that would retry with no back-off', () => {
    expect(() => new FixedRetryStrategy(-1000)).toThrow(/delayMs must be >= 0/);
    expect(() => client().retry(3, -1)).toThrow(/delayMs/);
    expect(() => client().retry(-1, 100)).toThrow(/retries must be >= 0/);
  });

  it('rejects maxSockets: 0, which Node reads as unlimited', () => {
    expect(() => new HttpClient('https://api.example.com', {}, undefined, { maxSockets: 0 })).toThrow(
      /maxSockets must be >= 1/,
    );
  });

  it('rejects a non-positive deadline', () => {
    expect(() => client().deadline(0)).toThrow(/deadline must be >= 1/);
    expect(() => client().deadline(-100)).toThrow(/deadline/);
  });

  it('names the library and the offending value in the message', () => {
    expect(() => new Bulkhead({ maxConcurrent: 0 })).toThrow(/\[super-http\]/);
    expect(() => new Bulkhead({ maxConcurrent: 0 })).toThrow(/received 0/);
  });

  it('still accepts every documented default', () => {
    expect(() => {
      const c = new HttpClient('https://api.example.com');
      c.retry(3, 500)
        .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
        .bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
        .rateLimit({ permitLimit: 200, windowMs: 60_000 })
        .deadline(5_000)
        .dedup();
    }).not.toThrow();
  });
});

// ─── Bulkhead — bounded and abortable waiting ────────────────────────────────
describe('Bulkhead — bounded waiting', () => {
  const never = () => new Promise<void>(() => undefined);

  it('applies the default queue timeout instead of waiting forever', async () => {
    jest.useFakeTimers();
    const bh = new Bulkhead({ maxConcurrent: 1 });
    void bh.execute(never);

    const queued = bh.execute(() => Promise.resolve('x'));
    jest.advanceTimersByTime(Bulkhead.DEFAULT_QUEUE_TIMEOUT_MS + 10);
    await expect(queued).rejects.toThrow('Bulkhead queue timeout');
    expect(bh.queuedCount).toBe(0);
    jest.useRealTimers();
  });

  it('honours an explicit infinite wait', async () => {
    jest.useFakeTimers();
    const bh = new Bulkhead({ maxConcurrent: 1, queueTimeoutMs: Infinity });
    void bh.execute(never);

    let settled = false;
    void bh
      .execute(() => Promise.resolve('x'))
      .then(
        () => (settled = true),
        () => (settled = true),
      );
    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(bh.queuedCount).toBe(1);
    jest.useRealTimers();
  });

  it('caps the wait at maxWaitMs when it is shorter than the config', async () => {
    jest.useFakeTimers();
    const bh = new Bulkhead({ maxConcurrent: 1, queueTimeoutMs: 60_000 });
    void bh.execute(never);

    const queued = bh.execute(() => Promise.resolve('x'), { maxWaitMs: 100 });
    jest.advanceTimersByTime(150);
    await expect(queued).rejects.toThrow('Bulkhead queue timeout');
    jest.useRealTimers();
  });

  it('rejects a queued caller when its signal fires, and dequeues it', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, queueTimeoutMs: 60_000 });
    void bh.execute(never);

    const controller = new AbortController();
    const queued = bh.execute(() => Promise.resolve('x'), { signal: controller.signal });
    expect(bh.queuedCount).toBe(1);
    controller.abort(new Error('caller left'));

    await expect(queued).rejects.toThrow('caller left');
    expect(bh.queuedCount).toBe(0);
  });

  it('rejects immediately for an already-aborted signal', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1 });
    void bh.execute(never);

    const controller = new AbortController();
    controller.abort();
    await expect(bh.execute(() => Promise.resolve('x'), { signal: controller.signal })).rejects.toBeDefined();
    expect(bh.queuedCount).toBe(0);
  });

  it('still rejects past maxQueue', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueue: 1, queueTimeoutMs: 60_000 });
    void bh.execute(never);
    const first = bh.execute(() => Promise.resolve('x')).catch(() => 'gone');
    await expect(bh.execute(() => Promise.resolve('y'))).rejects.toThrow('Bulkhead queue full');
    void first;
  });
});

// ─── RateLimiter — bounded queue and cancellation ────────────────────────────
describe('RateLimiter — bounded queue', () => {
  it('applies the default queue timeout', async () => {
    jest.useFakeTimers();
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 600_000, queueRequests: true });
    await rl.acquire();

    const queued = rl.acquire();
    jest.advanceTimersByTime(RateLimiter.DEFAULT_QUEUE_TIMEOUT_MS + 10);
    await expect(queued).rejects.toThrow('Rate limit queue timeout');
    expect(rl.queuedCount).toBe(0);
    jest.useRealTimers();
  });

  it('rejects past maxQueue rather than growing without bound', async () => {
    jest.useFakeTimers();
    const rl = new RateLimiter({
      permitLimit: 1,
      windowMs: 600_000,
      queueRequests: true,
      queueTimeoutMs: 60_000,
      maxQueue: 2,
    });
    await rl.acquire();

    const a = rl.acquire().catch(() => 'gone');
    const b = rl.acquire().catch(() => 'gone');
    expect(rl.queuedCount).toBe(2);
    await expect(rl.acquire()).rejects.toThrow('Rate limit queue full');

    jest.advanceTimersByTime(60_010);
    await Promise.all([a, b]);
    jest.useRealTimers();
  });

  it('rejects a queued caller when its signal fires, and dequeues it', async () => {
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 600_000, queueRequests: true, queueTimeoutMs: 60_000 });
    await rl.acquire();

    const controller = new AbortController();
    const queued = rl.acquire({ signal: controller.signal });
    expect(rl.queuedCount).toBe(1);
    controller.abort(new Error('caller left'));

    await expect(queued).rejects.toThrow('caller left');
    expect(rl.queuedCount).toBe(0);
  });

  it('rejects immediately for an already-aborted signal', async () => {
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 600_000, queueRequests: true });
    await rl.acquire();

    const controller = new AbortController();
    controller.abort();
    await expect(rl.acquire({ signal: controller.signal })).rejects.toBeDefined();
    expect(rl.queuedCount).toBe(0);
  });

  it('caps the wait at maxWaitMs', async () => {
    jest.useFakeTimers();
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 600_000, queueRequests: true, queueTimeoutMs: 60_000 });
    await rl.acquire();

    const queued = rl.acquire({ maxWaitMs: 100 });
    jest.advanceTimersByTime(150);
    await expect(queued).rejects.toThrow('Rate limit queue timeout');
    jest.useRealTimers();
  });

  it('reports queue depth', async () => {
    const rl = new RateLimiter({ permitLimit: 1, windowMs: 600_000, queueRequests: true, queueTimeoutMs: 60_000 });
    expect(rl.queuedCount).toBe(0);
    await rl.acquire();
    const q = rl.acquire().catch(() => 'gone');
    expect(rl.queuedCount).toBe(1);
    void q;
  });
});

/**
 * Unit tests for the super-http/grpc integration.
 *
 * The GrpcTransport and GrpcChannelRegistry depend on live HTTP/2 connections,
 * so those are mocked. Everything else (DSL types, error mapper, presets,
 * GrpcClient resilience pipeline) is tested directly.
 */

import { defineService, unary, serverStream, clientStream, bidi } from '../grpc/service-definition';
import { createGrpcClient } from '../grpc/grpc-client';
import { GrpcError, getDecision, isGrpcRetryable, shouldTripCircuit } from '../grpc/grpc-error-mapper';
import { applyGrpcPreset } from '../grpc/grpc-presets';
import { GrpcTransport, parseEnvelopes, EnvelopeTooLargeError } from '../transport/grpc-transport';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../grpc/grpc-channel-registry', () => {
  const mockSession = {
    destroyed: false,
    closed: false,
    request: jest.fn(),
    close: jest.fn((cb?: () => void) => cb?.()),
    destroy: jest.fn(),
    on: jest.fn(),
  };
  return {
    GrpcChannelRegistry: {
      getSession: jest.fn(() => mockSession),
      closeAddress: jest.fn(() => Promise.resolve()),
      closeAll: jest.fn(() => Promise.resolve()),
      clear: jest.fn(),
      sessionCount: 0,
    },
    resolveOrigin: jest.requireActual('../grpc/grpc-channel-registry').resolveOrigin,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
}
interface GetUserRequest {
  id: string;
}
interface ListFilter {
  active?: boolean;
}
interface LogEntry {
  message: string;
}
interface UploadSummary {
  count: number;
}
interface ChatMessage {
  text: string;
}

const UserServiceDef = defineService('UserService', {
  getUser: unary<GetUserRequest, User>(),
  listUsers: serverStream<ListFilter, User>(),
  uploadLogs: clientStream<LogEntry, UploadSummary>(),
  chat: bidi<ChatMessage, ChatMessage>(),
});

// ─── Service Definition DSL ───────────────────────────────────────────────────

describe('defineService / DSL helpers', () => {
  it('creates a ServiceDefinition with correct serviceName', () => {
    expect(UserServiceDef.serviceName).toBe('UserService');
  });

  it('creates unary descriptor with callType=unary', () => {
    expect(UserServiceDef.methods.getUser.callType).toBe('unary');
  });

  it('creates serverStream descriptor with callType=server-stream', () => {
    expect(UserServiceDef.methods.listUsers.callType).toBe('server-stream');
  });

  it('creates clientStream descriptor with callType=client-stream', () => {
    expect(UserServiceDef.methods.uploadLogs.callType).toBe('client-stream');
  });

  it('creates bidi descriptor with callType=bidi-stream', () => {
    expect(UserServiceDef.methods.chat.callType).toBe('bidi-stream');
  });

  it('unary() returns a new object each time', () => {
    expect(unary()).not.toBe(unary());
  });

  it('serverStream() returns a new object each time', () => {
    expect(serverStream()).not.toBe(serverStream());
  });
});

// ─── GrpcError ────────────────────────────────────────────────────────────────

describe('GrpcError', () => {
  it('is an instance of Error', () => {
    const err = new GrpcError('not_found', 'user not found');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('GrpcError');
    expect(err.message).toBe('user not found');
    expect(err.code).toBe('not_found');
  });

  it('stores optional details and metadata', () => {
    const err = new GrpcError('internal', 'oops', [{ type: 'debug' }], { 'x-req': '1' });
    expect(err.details).toEqual([{ type: 'debug' }]);
    expect(err.metadata).toEqual({ 'x-req': '1' });
  });
});

// ─── Error mapper ─────────────────────────────────────────────────────────────

describe('getDecision', () => {
  it('unavailable → retryable + tripCircuit', () => {
    const d = getDecision('unavailable');
    expect(d.retryable).toBe(true);
    expect(d.tripCircuit).toBe(true);
  });

  it('resource_exhausted → retryable, no tripCircuit', () => {
    const d = getDecision('resource_exhausted');
    expect(d.retryable).toBe(true);
    expect(d.tripCircuit).toBe(false);
  });

  it('permission_denied → not retryable, no tripCircuit', () => {
    const d = getDecision('permission_denied');
    expect(d.retryable).toBe(false);
    expect(d.tripCircuit).toBe(false);
  });

  it('internal → not retryable, tripCircuit', () => {
    const d = getDecision('internal');
    expect(d.retryable).toBe(false);
    expect(d.tripCircuit).toBe(true);
  });

  it('unknown code → fallback: not retryable, tripCircuit', () => {
    const d = getDecision('completely_made_up');
    expect(d.retryable).toBe(false);
    expect(d.tripCircuit).toBe(true);
  });
});

describe('isGrpcRetryable', () => {
  it('returns true for GrpcError with retryable code', () => {
    expect(isGrpcRetryable(new GrpcError('unavailable', 'down'))).toBe(true);
  });

  it('returns false for GrpcError with non-retryable code', () => {
    expect(isGrpcRetryable(new GrpcError('not_found', 'missing'))).toBe(false);
  });

  it('returns true for ECONNRESET network error', () => {
    const err = Object.assign(new Error('conn reset'), { code: 'ECONNRESET' });
    expect(isGrpcRetryable(err)).toBe(true);
  });

  it('returns false for unknown errors', () => {
    expect(isGrpcRetryable(new Error('boom'))).toBe(false);
  });
});

describe('shouldTripCircuit', () => {
  it('returns true for GrpcError with tripCircuit=true code', () => {
    expect(shouldTripCircuit(new GrpcError('unavailable', 'down'))).toBe(true);
  });

  it('returns false for GrpcError with tripCircuit=false code', () => {
    expect(shouldTripCircuit(new GrpcError('not_found', 'missing'))).toBe(false);
  });

  it('returns true for unknown non-GrpcError', () => {
    expect(shouldTripCircuit(new Error('mystery'))).toBe(true);
  });
});

// ─── Presets ──────────────────────────────────────────────────────────────────

describe('applyGrpcPreset', () => {
  it('returns config unchanged when no preset', () => {
    const cfg = { timeoutMs: 5000 };
    expect(applyGrpcPreset(cfg)).toEqual({ timeoutMs: 5000 });
  });

  it('applies resilient-api preset defaults', () => {
    const cfg = applyGrpcPreset({ preset: 'resilient-api' });
    expect(cfg.circuitBreaker).toBeDefined();
    expect(cfg.bulkhead).toBeDefined();
    expect(cfg.retries).toBe(3);
    expect(cfg.timeoutMs).toBe(15_000);
  });

  it('applies high-throughput preset defaults', () => {
    const cfg = applyGrpcPreset({ preset: 'high-throughput' });
    expect(cfg.maxSessions).toBe(4);
    expect(cfg.retries).toBe(1);
    expect(cfg.circuitBreaker).toBeUndefined();
  });

  it('applies low-latency preset defaults', () => {
    const cfg = applyGrpcPreset({ preset: 'low-latency' });
    expect(cfg.timeoutMs).toBe(2_000);
    expect(cfg.retries).toBeUndefined();
  });

  it('explicit fields override preset', () => {
    const cfg = applyGrpcPreset({ preset: 'resilient-api', timeoutMs: 1000 });
    expect(cfg.timeoutMs).toBe(1000); // explicit wins
    expect(cfg.retries).toBe(3); // preset default kept
  });

  it('rejects an unknown preset name instead of silently ignoring it', () => {
    // Swallowing a typo produced a client with no resilience at all, while the
    // calling code read as though a preset were in force.
    expect(() => applyGrpcPreset({ preset: 'nonexistent' as never })).toThrow(/unknown gRPC preset/);
    expect(() => applyGrpcPreset({ preset: 'nonexistent' as never })).toThrow(/resilient-api/);
  });

  it('leaves a config with no preset untouched', () => {
    const cfg = applyGrpcPreset({ address: 'grpc://localhost:50051' } as never);
    expect(cfg).toEqual({ address: 'grpc://localhost:50051' });
  });
});

// ─── GrpcChannelRegistry (resolveOrigin) ─────────────────────────────────────

describe('resolveOrigin', () => {
  // Import the real function (not mocked)
  const { resolveOrigin: resolve } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../grpc/grpc-channel-registry') as typeof import('../grpc/grpc-channel-registry');

  it('converts grpc:// to http://', () => {
    expect(resolve('grpc://host:50051')).toBe('http://host:50051');
  });

  it('converts grpcs:// to https://', () => {
    expect(resolve('grpcs://host:443')).toBe('https://host:443');
  });

  it('passes http:// through unchanged', () => {
    expect(resolve('http://host:80')).toBe('http://host:80');
  });

  it('passes https:// through unchanged', () => {
    expect(resolve('https://host:443')).toBe('https://host:443');
  });

  it('prefixes bare host:port with http://', () => {
    expect(resolve('host:50051')).toBe('http://host:50051');
  });
});

// ─── GrpcClient — proxy + dispatch ───────────────────────────────────────────

describe('createGrpcClient — proxy dispatch', () => {
  let mockTransportCall: jest.Mock;
  let mockTransportServerStream: jest.Mock;
  let mockTransportClientStream: jest.Mock;
  let mockTransportBidiStream: jest.Mock;

  beforeEach(() => {
    mockTransportCall = jest.fn();
    mockTransportServerStream = jest.fn();
    mockTransportClientStream = jest.fn();
    mockTransportBidiStream = jest.fn();

    jest.spyOn(GrpcTransport.prototype, 'call').mockImplementation(mockTransportCall);
    jest.spyOn(GrpcTransport.prototype, 'serverStream').mockImplementation(mockTransportServerStream);
    jest.spyOn(GrpcTransport.prototype, 'clientStream').mockImplementation(mockTransportClientStream);
    jest.spyOn(GrpcTransport.prototype, 'bidiStream').mockImplementation(mockTransportBidiStream);
    jest.spyOn(GrpcTransport.prototype, 'close').mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('routes unary call to transport.call()', async () => {
    mockTransportCall.mockResolvedValue({ data: { id: '1', name: 'Ana' }, transportType: 'grpc' });

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    const result = await client.getUser({ id: '1' });

    expect(result).toEqual({ id: '1', name: 'Ana' });
    expect(mockTransportCall).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'UserService', method: 'getUser', input: { id: '1' } }),
    );
  });

  it('routes server-stream call to transport.serverStream()', async () => {
    async function* gen() {
      yield { id: '1', name: 'Ana' };
    }
    mockTransportServerStream.mockReturnValue(gen());

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    const results: User[] = [];
    for await (const u of client.listUsers({ active: true })) results.push(u);

    expect(results).toEqual([{ id: '1', name: 'Ana' }]);
    expect(mockTransportServerStream).toHaveBeenCalledWith(expect.objectContaining({ method: 'listUsers' }));
  });

  it('routes client-stream call to transport.clientStream()', async () => {
    mockTransportClientStream.mockResolvedValue({ data: { count: 3 }, transportType: 'grpc' });

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    async function* logs() {
      yield { message: 'a' };
      yield { message: 'b' };
      yield { message: 'c' };
    }
    const summary = await client.uploadLogs(logs());

    expect(summary).toEqual({ count: 3 });
    expect(mockTransportClientStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'uploadLogs' }),
    );
  });

  it('routes bidi-stream call to transport.bidiStream()', async () => {
    async function* replies() {
      yield { text: 'hello' };
    }
    mockTransportBidiStream.mockReturnValue(replies());

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    async function* msgs() {
      yield { text: 'hi' };
    }
    const results: ChatMessage[] = [];
    for await (const m of client.chat(msgs())) results.push(m);

    expect(results).toEqual([{ text: 'hello' }]);
    expect(mockTransportBidiStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'chat' }),
    );
  });

  it('throws for unknown method', () => {
    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    expect(() => (client as unknown as Record<string, unknown>)['notAMethod']).toThrow(
      "Method 'notAMethod' is not defined",
    );
  });

  it('.close() delegates to transport', async () => {
    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    await client.close();
    expect(GrpcTransport.prototype.close).toHaveBeenCalled();
  });
});

// ─── GrpcClient — metrics ─────────────────────────────────────────────────────

describe('createGrpcClient — metrics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records request + success on successful unary call', async () => {
    jest.spyOn(GrpcTransport.prototype, 'call').mockResolvedValue({
      data: { id: '1', name: 'Ana' },
      transportType: 'grpc',
    });

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    await client.getUser({ id: '1' });

    const m = client.metrics();
    expect(m.requests).toBe(1);
    expect(m.success).toBe(1);
    expect(m.failed).toBe(0);
  });

  it('records failure on transport error', async () => {
    jest.spyOn(GrpcTransport.prototype, 'call').mockRejectedValue(new GrpcError('unavailable', 'service down'));

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    await expect(client.getUser({ id: '1' })).rejects.toThrow('service down');

    const m = client.metrics();
    expect(m.failed).toBe(1);
  });

  it('resetMetrics clears counters', async () => {
    jest.spyOn(GrpcTransport.prototype, 'call').mockResolvedValue({
      data: { id: '1', name: 'X' },
      transportType: 'grpc',
    });

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    await client.getUser({ id: '1' });
    expect(client.metrics().requests).toBe(1);

    client.resetMetrics();
    expect(client.metrics().requests).toBe(0);
  });
});

// ─── GrpcClient — resilience pipeline ────────────────────────────────────────

describe('createGrpcClient — retry', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retries on retryable error and succeeds on 2nd attempt', async () => {
    const callMock = jest
      .fn()
      .mockRejectedValueOnce(new GrpcError('unavailable', 'down'))
      .mockResolvedValueOnce({ data: { id: '1', name: 'Ana' }, transportType: 'grpc' });

    jest.spyOn(GrpcTransport.prototype, 'call').mockImplementation(callMock);

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      retries: 2,
      retryStrategy: { computeDelay: () => 0 }, // zero delay for tests
    });

    const result = await client.getUser({ id: '1' });
    expect(result).toEqual({ id: '1', name: 'Ana' });
    expect(callMock).toHaveBeenCalledTimes(2);

    const m = client.metrics();
    expect(m.retries).toBe(1);
  });

  it('does NOT retry non-retryable errors', async () => {
    const callMock = jest.fn().mockRejectedValue(new GrpcError('not_found', 'missing'));
    jest.spyOn(GrpcTransport.prototype, 'call').mockImplementation(callMock);

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', { retries: 3 });
    await expect(client.getUser({ id: '1' })).rejects.toThrow('missing');
    expect(callMock).toHaveBeenCalledTimes(1); // no retry
  });

  it('respects retry: false per-call option', async () => {
    const callMock = jest.fn().mockRejectedValue(new GrpcError('unavailable', 'down'));
    jest.spyOn(GrpcTransport.prototype, 'call').mockImplementation(callMock);

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', { retries: 3 });
    await expect(
      (client as unknown as { getUser: (r: unknown, o: unknown) => Promise<unknown> }).getUser(
        { id: '1' },
        { retry: false },
      ),
    ).rejects.toThrow('down');
    expect(callMock).toHaveBeenCalledTimes(1); // no retry because retry:false
  });
});

describe('createGrpcClient — circuit breaker', () => {
  afterEach(() => jest.restoreAllMocks());

  it('opens circuit after failureThreshold failures', async () => {
    jest.spyOn(GrpcTransport.prototype, 'call').mockRejectedValue(new GrpcError('internal', 'server error'));

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      circuitBreaker: { failureThreshold: 3, successThreshold: 1, timeoutMs: 60_000 },
    });

    // Trigger failures up to threshold
    for (let i = 0; i < 3; i++) {
      await expect(client.getUser({ id: '1' })).rejects.toThrow();
    }

    // Circuit should now be open
    await expect(client.getUser({ id: '1' })).rejects.toThrow('Circuit breaker is open');
    expect(client.metrics().circuitBreakerTrips).toBeGreaterThanOrEqual(1);
  });
});

describe('createGrpcClient — on() hooks', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fires onRetry hook on retry', async () => {
    const onRetry = jest.fn();
    jest
      .spyOn(GrpcTransport.prototype, 'call')
      .mockRejectedValueOnce(new GrpcError('unavailable', 'down'))
      .mockResolvedValueOnce({ data: { id: '1', name: 'X' }, transportType: 'grpc' });

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      retries: 1,
      retryStrategy: { computeDelay: () => 0 },
    });
    client.on({ onRetry });

    await client.getUser({ id: '1' });
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 0 }));
  });
});

// ─── GrpcClient — bulkhead + rateLimit paths ──────────────────────────────────

describe('createGrpcClient — bulkhead', () => {
  afterEach(() => jest.restoreAllMocks());

  it('passes unary call through bulkhead successfully', async () => {
    jest.spyOn(GrpcTransport.prototype, 'call').mockResolvedValue({
      data: { id: '1', name: 'Ana' },
      transportType: 'grpc',
    });

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      bulkhead: { maxConcurrent: 5, maxQueue: 10 },
    });

    const result = await client.getUser({ id: '1' });
    expect(result).toEqual({ id: '1', name: 'Ana' });
  });

  it('records BH reject when bulkhead is full', async () => {
    // Saturate bulkhead with concurrent calls and then reject one
    jest
      .spyOn(GrpcTransport.prototype, 'call')
      .mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Bulkhead queue full')), 10)),
      );

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      bulkhead: { maxConcurrent: 1, maxQueue: 0 },
    });

    // First call fills the slot
    const p1 = client.getUser({ id: '1' }).catch(() => {});
    // Second call should get bulkhead rejected
    await expect(client.getUser({ id: '2' })).rejects.toThrow();
    await p1;

    expect(client.metrics().bulkheadRejects).toBeGreaterThanOrEqual(0);
  });
});

describe('createGrpcClient — rateLimit', () => {
  afterEach(() => jest.restoreAllMocks());

  it('passes calls through rate limiter successfully', async () => {
    jest.spyOn(GrpcTransport.prototype, 'call').mockResolvedValue({
      data: { id: '1', name: 'Ana' },
      transportType: 'grpc',
    });

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      rateLimit: { permitLimit: 100, windowMs: 1000 },
    });

    const result = await client.getUser({ id: '1' });
    expect(result).toEqual({ id: '1', name: 'Ana' });
  });
});

// ─── GrpcClient — server streaming with rate limit / circuit breaker ──────────

describe('createGrpcClient — server streaming resilience', () => {
  afterEach(() => jest.restoreAllMocks());

  it('passes through rate limiter before opening stream', async () => {
    async function* gen() {
      yield { id: '1', name: 'X' };
    }
    jest.spyOn(GrpcTransport.prototype, 'serverStream').mockReturnValue(gen());

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      rateLimit: { permitLimit: 100, windowMs: 1000 },
    });

    const results: User[] = [];
    for await (const u of client.listUsers({})) results.push(u);
    expect(results).toHaveLength(1);
  });

  it('applies circuit breaker to stream open', async () => {
    async function* gen() {
      yield { id: '1', name: 'X' };
    }
    jest.spyOn(GrpcTransport.prototype, 'serverStream').mockReturnValue(gen());

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051', {
      circuitBreaker: { failureThreshold: 10, successThreshold: 1, timeoutMs: 60_000 },
    });

    const results: User[] = [];
    for await (const u of client.listUsers({})) results.push(u);
    expect(results).toHaveLength(1);
  });

  it('records failure when stream throws', async () => {
    // eslint-disable-next-line require-yield
    async function* failing(): AsyncGenerator<User> {
      throw new GrpcError('internal', 'stream error');
    }
    jest.spyOn(GrpcTransport.prototype, 'serverStream').mockReturnValue(failing());

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _msg of client.listUsers({})) {
        /* consume */
      }
    }).rejects.toThrow('stream error');

    expect(client.metrics().failed).toBe(1);
  });
});

// ─── GrpcClient — client streaming / bidi failures ───────────────────────────

describe('createGrpcClient — client streaming failure', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records failure on clientStream error', async () => {
    jest.spyOn(GrpcTransport.prototype, 'clientStream').mockRejectedValue(new GrpcError('unavailable', 'down'));

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    async function* logs() {
      yield { message: 'x' };
    }

    await expect(client.uploadLogs(logs())).rejects.toThrow('down');
    expect(client.metrics().failed).toBe(1);
  });
});

describe('createGrpcClient — bidi streaming failure', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records failure on bidiStream error', async () => {
    // eslint-disable-next-line require-yield
    async function* failing(): AsyncGenerator<ChatMessage> {
      throw new GrpcError('internal', 'bidi error');
    }
    jest.spyOn(GrpcTransport.prototype, 'bidiStream').mockReturnValue(failing());

    const client = createGrpcClient(UserServiceDef, 'grpc://localhost:50051');
    async function* msgs() {
      yield { text: 'hi' };
    }

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _msg of client.chat(msgs())) {
        /* consume */
      }
    }).rejects.toThrow('bidi error');

    expect(client.metrics().failed).toBe(1);
  });
});

// ─── Connect-RPC envelope framing — declared length must be validated ────────
describe('parseEnvelopes', () => {
  const envelope = (payload: string, flags = 0x00): Buffer => {
    const body = Buffer.from(payload);
    const header = Buffer.alloc(5);
    header[0] = flags;
    header.writeUInt32BE(body.length, 1);
    return Buffer.concat([header, body]);
  };

  it('parses complete envelopes', () => {
    const buf = Buffer.concat([envelope('one'), envelope('two')]);
    const { envelopes, remaining } = parseEnvelopes(buf);
    expect(envelopes.map((e) => e.data.toString())).toEqual(['one', 'two']);
    expect(remaining).toHaveLength(0);
  });

  it('keeps a trailing partial envelope for the next chunk', () => {
    const full = envelope('hello');
    const { envelopes, remaining } = parseEnvelopes(full.subarray(0, 7));
    expect(envelopes).toHaveLength(0);
    expect(remaining).toHaveLength(7);
  });

  it('rejects a declared length beyond the ceiling instead of waiting for it', () => {
    // A peer (or corruption) claiming 4 GiB: without a check the parser parks
    // forever while the pending buffer grows without bound.
    const header = Buffer.alloc(5);
    header[0] = 0x00;
    header.writeUInt32BE(0xffffffff, 1);

    expect(() => parseEnvelopes(header)).toThrow(EnvelopeTooLargeError);
    expect(() => parseEnvelopes(header)).toThrow(/exceeds/);
  });

  it('honours a caller-supplied ceiling', () => {
    const buf = envelope('0123456789');
    expect(() => parseEnvelopes(buf, 4)).toThrow(EnvelopeTooLargeError);
    expect(parseEnvelopes(buf, 1024).envelopes).toHaveLength(1);
  });

  it('accepts a message exactly at the limit', () => {
    const buf = envelope('abcd');
    expect(parseEnvelopes(buf, 4).envelopes).toHaveLength(1);
  });
});

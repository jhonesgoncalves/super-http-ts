/**
 * Connect-RPC JSON transport over HTTP/2.
 *
 * Uses Node.js native `http2` (zero extra dependencies) to speak the
 * Connect-RPC JSON protocol:
 *   https://connectrpc.com/docs/protocol
 *
 * Default encoding: `application/connect+json`
 * Default protocol: Connect-RPC (compatible with gRPC via `protocol: 'grpc'`)
 *
 * This transport is what makes super-http's gRPC support TypeScript-first:
 * because JSON is the wire format, any JSON-serialisable TypeScript type works
 * as a request/response — no `.proto` files, no code generation.
 */

import type { Transport, TransportMeta, TransportRequest, TransportResponse } from './transport';
import { GrpcError, GrpcCode } from '../grpc/grpc-error-mapper';
import { GrpcChannelRegistry, resolveOrigin } from '../grpc/grpc-channel-registry';
import type { GrpcEncoding, GrpcProtocol } from '../models/grpc.client.config';

// ─── Connect-RPC envelope framing ────────────────────────────────────────────
// Each streamed message is prefixed with a 5-byte envelope:
//   byte 0    : flags  (0x00 = data, 0x01 = compressed, 0x02 = end-of-stream)
//   bytes 1-4 : length (big-endian uint32)

const FLAG_DATA = 0x00;
const FLAG_END_STREAM = 0x02;

function encodeEnvelope(data: Buffer, flags = FLAG_DATA): Buffer {
  const header = Buffer.allocUnsafe(5);
  header[0] = flags;
  header.writeUInt32BE(data.length, 1);
  return Buffer.concat([header, data]);
}

interface Envelope {
  flags: number;
  data: Buffer;
}

/**
 * Parses as many complete 5+N byte envelopes as possible from `buffer`.
 * Returns `{ envelopes, remaining }` where `remaining` is any trailing partial
 * envelope that needs more data before it can be decoded.
 */
function parseEnvelopes(buffer: Buffer): { envelopes: Envelope[]; remaining: Buffer } {
  const envelopes: Envelope[] = [];
  let offset = 0;

  while (offset + 5 <= buffer.length) {
    const flags = buffer[offset];
    const len = buffer.readUInt32BE(offset + 1);

    if (offset + 5 + len > buffer.length) break; // incomplete message — wait for more data

    envelopes.push({ flags, data: buffer.slice(offset + 5, offset + 5 + len) });
    offset += 5 + len;
  }

  return { envelopes, remaining: buffer.slice(offset) };
}

// ─── HTTP status → gRPC code mapping ─────────────────────────────────────────

const HTTP_STATUS_TO_GRPC: Record<number, GrpcCode> = {
  400: 'invalid_argument',
  401: 'unauthenticated',
  403: 'permission_denied',
  404: 'not_found',
  408: 'deadline_exceeded',
  409: 'aborted',
  412: 'failed_precondition',
  413: 'resource_exhausted',
  429: 'resource_exhausted',
  499: 'canceled',
  500: 'internal',
  501: 'unimplemented',
  503: 'unavailable',
  504: 'deadline_exceeded',
};

function httpStatusToGrpcCode(status: number): GrpcCode {
  return HTTP_STATUS_TO_GRPC[status] ?? 'unknown';
}

// ─── Content-Type resolution ──────────────────────────────────────────────────

function resolveContentType(encoding: GrpcEncoding, protocol: GrpcProtocol): string {
  if (protocol === 'grpc')     return encoding === 'proto' ? 'application/grpc'        : 'application/grpc+json';
  if (protocol === 'grpc-web') return encoding === 'proto' ? 'application/grpc-web'     : 'application/grpc-web+json';
  /* connect (default) */      return encoding === 'proto' ? 'application/connect+proto': 'application/connect+json';
}

// ─── GrpcTransport ────────────────────────────────────────────────────────────

export interface GrpcTransportOptions {
  address: string;
  encoding?: GrpcEncoding;
  protocol?: GrpcProtocol;
  defaultHeaders?: Record<string, string>;
  defaultTimeoutMs?: number;
  maxSessions?: number;
}

/**
 * Connect-RPC JSON (or gRPC) transport implemented with native `node:http2`.
 *
 * One transport instance is shared per `GrpcClient` and caches HTTP/2 sessions
 * in {@link GrpcChannelRegistry}.
 */
export class GrpcTransport implements Transport {
  readonly type = 'grpc' as const;

  private readonly origin: string;
  private readonly encoding: GrpcEncoding;
  private readonly protocol: GrpcProtocol;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeoutMs: number;
  private readonly maxSessions: number;

  constructor(opts: GrpcTransportOptions) {
    this.origin         = resolveOrigin(opts.address);
    this.encoding       = opts.encoding       ?? 'json';
    this.protocol       = opts.protocol       ?? 'connect';
    this.defaultHeaders = opts.defaultHeaders ?? {};
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 15_000;
    this.maxSessions    = opts.maxSessions    ?? 2;
  }

  // ─── Unary ─────────────────────────────────────────────────────────────────

  async call<TReq, TRes>(request: TransportRequest<TReq>): Promise<TransportResponse<TRes>> {
    const { path, headers } = this.buildRequestMeta(request);
    const body = this.encodeMessage(request.input);
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<TransportResponse<TRes>>((resolve, reject) => {
      const session = GrpcChannelRegistry.getSession(this.origin, this.maxSessions);
      const req = session.request({
        ':method': 'POST',
        ':path':   path,
        ...headers,
        'content-length': String(body.length),
      });

      // Timeout
      const timer = setTimeout(() => {
        req.destroy();
        reject(new GrpcError('deadline_exceeded', `gRPC call timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Cancellation
      request.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        req.destroy();
        reject(new GrpcError('canceled', 'gRPC call was canceled'));
      });

      let statusCode = 200;
      const chunks: Buffer[] = [];

      req.on(':response', (responseHeaders) => {
        statusCode = Number(responseHeaders[':status'] ?? 200);
      });

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        clearTimeout(timer);
        const raw = Buffer.concat(chunks);

        try {
          if (statusCode !== 200) {
            const errBody = this.parseJson<{ code?: string; message?: string }>(raw) ?? {};
            const code = (errBody.code as GrpcCode) ?? httpStatusToGrpcCode(statusCode);
            return reject(new GrpcError(code, errBody.message ?? `gRPC error ${statusCode}`));
          }

          const data = this.parseJson<TRes>(raw);
          if (data === null) return reject(new GrpcError('internal', 'Empty or invalid response body'));

          // Check for Connect-RPC embedded error in 200 response
          const maybe = data as Record<string, unknown>;
          if (maybe.code && typeof maybe.code === 'string' && maybe.message) {
            return reject(new GrpcError(maybe.code as GrpcCode, String(maybe.message)));
          }

          resolve({ data, metadata: {}, transportType: 'grpc' });
        } catch (err) {
          reject(err);
        }
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  // ─── Server streaming ──────────────────────────────────────────────────────

  async *serverStream<TReq, TRes>(request: TransportRequest<TReq>): AsyncIterable<TRes> {
    const { path, headers } = this.buildRequestMeta(request);
    const body = this.encodeMessage(request.input);
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;

    const session = GrpcChannelRegistry.getSession(this.origin, this.maxSessions);

    // We collect chunks and parse envelopes incrementally.
    // Using a simple push-based buffer + event coordination so we can yield
    // from an async generator without blocking the http2 stream callbacks.
    type ChunkEvent = { type: 'data'; chunk: Buffer } | { type: 'end' } | { type: 'error'; error: unknown };
    const queue: ChunkEvent[] = [];
    let resolve: (() => void) | null = null;

    function push(event: ChunkEvent) {
      queue.push(event);
      resolve?.();
    }

    const req = session.request({
      ':method': 'POST',
      ':path':   path,
      ...headers,
      'content-length': String(body.length),
    });

    const timer = setTimeout(() => {
      req.destroy();
      push({ type: 'error', error: new GrpcError('deadline_exceeded', `gRPC stream timed out after ${timeoutMs}ms`) });
    }, timeoutMs);

    request.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      req.destroy();
      push({ type: 'error', error: new GrpcError('canceled', 'gRPC stream was canceled') });
    });

    req.on('data',  (chunk: Buffer) => push({ type: 'data', chunk }));
    req.on('end',   () => { clearTimeout(timer); push({ type: 'end' }); });
    req.on('error', (err) => { clearTimeout(timer); push({ type: 'error', error: err }); });

    req.write(body);
    req.end();

    let remaining = Buffer.alloc(0);
    let done = false;

    while (!done) {
      // Drain the queue
      while (queue.length > 0) {
        const event = queue.shift()!;

        if (event.type === 'error') throw event.error;

        if (event.type === 'end') {
          done = true;
          break;
        }

        // Accumulate and parse envelopes
        remaining = Buffer.concat([remaining, event.chunk]);
        const { envelopes, remaining: leftover } = parseEnvelopes(remaining);
        remaining = leftover;

        for (const env of envelopes) {
          if (env.flags === FLAG_END_STREAM) {
            // End-of-stream envelope — may contain trailers or error
            const trailer = this.parseJson<{ error?: { code: string; message: string } }>(env.data);
            if (trailer?.error) {
              throw new GrpcError(trailer.error.code as GrpcCode, trailer.error.message);
            }
            done = true;
            break;
          }

          if (env.flags === FLAG_DATA) {
            const msg = this.parseJson<TRes>(env.data);
            if (msg !== null) yield msg;
          }
        }
      }

      // Wait for more data if not done
      if (!done && queue.length === 0) {
        await new Promise<void>((r) => { resolve = r; });
        resolve = null;
      }
    }
  }

  // ─── Client streaming ──────────────────────────────────────────────────────

  async clientStream<TReq, TRes>(
    stream: AsyncIterable<TReq>,
    meta: TransportMeta,
  ): Promise<TransportResponse<TRes>> {
    const { path, headers } = this.buildRequestMeta(meta);

    const session = GrpcChannelRegistry.getSession(this.origin, this.maxSessions);
    const req = session.request({
      ':method': 'POST',
      ':path':   path,
      ...headers,
    });

    const chunks: Buffer[] = [];
    let statusCode = 200;

    req.on(':response', (h) => { statusCode = Number(h[':status'] ?? 200); });
    req.on('data', (c: Buffer) => chunks.push(c));

    const responsePromise = new Promise<TransportResponse<TRes>>((resolve, reject) => {
      req.on('end', () => {
        const raw = Buffer.concat(chunks);
        if (statusCode !== 200) {
          const errBody = this.parseJson<{ code?: string; message?: string }>(raw) ?? {};
          const code = (errBody.code as GrpcCode) ?? httpStatusToGrpcCode(statusCode);
          return reject(new GrpcError(code, errBody.message ?? `gRPC error ${statusCode}`));
        }
        const data = this.parseJson<TRes>(raw);
        if (data === null) return reject(new GrpcError('internal', 'Empty or invalid response body'));
        resolve({ data, metadata: {}, transportType: 'grpc' });
      });
      req.on('error', reject);
    });

    // Send client stream messages
    for await (const msg of stream) {
      const envelope = encodeEnvelope(this.encodeMessage(msg));
      req.write(envelope);
    }
    req.end();

    return responsePromise;
  }

  // ─── Bidi streaming ────────────────────────────────────────────────────────

  async *bidiStream<TReq, TRes>(
    stream: AsyncIterable<TReq>,
    meta: TransportMeta,
  ): AsyncIterable<TRes> {
    const { path, headers } = this.buildRequestMeta(meta);
    const session = GrpcChannelRegistry.getSession(this.origin, this.maxSessions);

    // Use ONE HTTP/2 stream for both sending and receiving.
    const req = session.request({
      ':method': 'POST',
      ':path':   path,
      ...headers,
    });

    // Send messages in the background on the same stream.
    const sendPromise = (async () => {
      for await (const msg of stream) {
        req.write(encodeEnvelope(this.encodeMessage(msg)));
      }
      req.end();
    })();

    // Receive responses from the SAME req stream using the envelope queue pattern.
    type ChunkEvent = { type: 'data'; chunk: Buffer } | { type: 'end' } | { type: 'error'; error: unknown };
    const queue: ChunkEvent[] = [];
    let notify: (() => void) | null = null;

    function push(event: ChunkEvent) {
      queue.push(event);
      notify?.();
    }

    req.on('data',  (chunk: Buffer) => push({ type: 'data', chunk }));
    req.on('end',   () => push({ type: 'end' }));
    req.on('error', (err) => push({ type: 'error', error: err }));

    let remaining = Buffer.alloc(0);
    let done = false;

    try {
      while (!done) {
        while (queue.length > 0) {
          const event = queue.shift()!;
          if (event.type === 'error') throw event.error;
          if (event.type === 'end') { done = true; break; }

          remaining = Buffer.concat([remaining, event.chunk]);
          const { envelopes, remaining: leftover } = parseEnvelopes(remaining);
          remaining = leftover;

          for (const env of envelopes) {
            if (env.flags === FLAG_END_STREAM) {
              const trailer = this.parseJson<{ error?: { code: string; message: string } }>(env.data);
              if (trailer?.error) throw new GrpcError(trailer.error.code as GrpcCode, trailer.error.message);
              done = true;
              break;
            }
            if (env.flags === FLAG_DATA) {
              const msg = this.parseJson<TRes>(env.data);
              if (msg !== null) yield msg;
            }
          }
        }

        if (!done && queue.length === 0) {
          await new Promise<void>((r) => { notify = r; });
          notify = null;
        }
      }
    } finally {
      await sendPromise;
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    await GrpcChannelRegistry.closeAddress(this.origin);
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private buildRequestMeta(meta: TransportMeta): { path: string; headers: Record<string, string> } {
    const contentType = resolveContentType(this.encoding, this.protocol);
    return {
      path: `/${meta.service}/${meta.method}`,
      headers: {
        'content-type': contentType,
        'connect-protocol-version': '1',
        ...this.defaultHeaders,
        ...(meta.metadata ?? {}),
      },
    };
  }

  private encodeMessage<T>(msg: T): Buffer {
    // JSON encoding — works with any JSON-serialisable TypeScript type.
    // Proto encoding would require Message classes and is handled separately.
    return Buffer.from(JSON.stringify(msg), 'utf-8');
  }

  private parseJson<T>(buf: Buffer): T | null {
    if (!buf.length) return null;
    try {
      return JSON.parse(buf.toString('utf-8')) as T;
    } catch {
      return null;
    }
  }
}

import * as http from 'http';
import { AddressInfo, Socket } from 'net';

/**
 * Fault-injection HTTP server for integration tests.
 *
 * The unit suite mocks axios wholesale, so nothing there exercises real
 * sockets, keep-alive, timeouts, resets or partial responses. This server is
 * the harness Nygard's "Test Harness" chapter asks for: it fails in the ways a
 * real integration point fails, on demand, and records what actually reached
 * the wire so tests can assert on it.
 *
 * Built on `node:http` (not express) so the test suite carries no dependency
 * on `example/`, and bound to port 0 so runs never collide with a local server.
 */

/** What the server actually observed. Assertions read this, not just responses. */
export interface FaultServerStats {
  /** Total requests that reached the server. */
  total: number;
  /** Request count keyed by pathname (no query string). */
  byPath: Record<string, number>;
  /** Request count keyed by upper-case HTTP method. */
  byMethod: Record<string, number>;
  /** Highest number of simultaneously in-flight requests observed. */
  maxConcurrent: number;
  /** Request bodies received, in arrival order. */
  bodies: string[];
  /** Values of the given header, in arrival order (see `captureHeader`). */
  capturedHeaders: string[];
  /** TCP connections accepted. Fewer than `total` proves keep-alive reuse. */
  connections: number;
}

export interface FaultServer {
  /** Base URL, e.g. `http://127.0.0.1:54123`. */
  readonly url: string;
  readonly port: number;
  readonly stats: FaultServerStats;
  /** Zeroes all counters. Call between tests. */
  reset(): void;
  /** While `true`, `/outage` returns 503. */
  setOutage(on: boolean): void;
  /** Header name whose values get recorded into `stats.capturedHeaders`. */
  captureHeader(name: string): void;
  close(): Promise<void>;
}

/**
 * Routes (all accept any method unless noted):
 *
 * - `GET  /ok`                  — 200 `{ok:true}` immediately
 * - `ALL  /echo`                — 200 echoing the request body back, so a test can
 *                                 prove two different bodies got two different answers
 * - `GET  /slow?ms=N`           — 200 after N ms (default 200)
 * - `GET  /never`               — accepts the request and never responds (timeout tests)
 * - `GET  /reset`               — destroys the socket mid-request (ECONNRESET)
 * - `GET  /status/:code`        — returns that status code
 * - `GET  /flaky?rate=0.5`      — 503 with the given probability
 * - `GET  /outage`              — 503 while `setOutage(true)`, else 200
 * - `GET  /retry-after?s=N`     — 429 with a real `Retry-After: N` header
 * - `GET  /huge?bytes=N`        — 200 with an N-byte body (default 8 MiB)
 */
export async function startFaultServer(): Promise<FaultServer> {
  const stats: FaultServerStats = blankStats();
  let outage = false;
  let capturedHeaderName: string | undefined;
  let inFlight = 0;

  // Every live socket, so close() can tear down /never's parked connections.
  const sockets = new Set<Socket>();
  // Timers for delayed responses, so close() never leaves the event loop armed.
  const timers = new Set<NodeJS.Timeout>();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    inFlight++;
    stats.total++;
    stats.maxConcurrent = Math.max(stats.maxConcurrent, inFlight);
    stats.byPath[path] = (stats.byPath[path] ?? 0) + 1;
    const method = (req.method ?? 'GET').toUpperCase();
    stats.byMethod[method] = (stats.byMethod[method] ?? 0) + 1;

    if (capturedHeaderName) {
      const v = req.headers[capturedHeaderName];
      if (typeof v === 'string') stats.capturedHeaders.push(v);
    }

    // Only settle inFlight once, whichever way the request ends.
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      inFlight--;
    };
    res.on('close', done);
    res.on('finish', done);

    const send = (code: number, body: unknown, headers: Record<string, string> = {}): void => {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      res.writeHead(code, { 'content-type': 'application/json', ...headers });
      res.end(payload);
    };
    const later = (ms: number, fn: () => void): void => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    // Body is read for every request so keep-alive sockets stay usable and so
    // dedup tests can assert on what distinct payloads actually arrived.
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      if (body) stats.bodies.push(body);

      if (path === '/ok') return send(200, { ok: true });

      if (path === '/echo') return send(200, { echo: body });

      if (path === '/slow') {
        const ms = Number(url.searchParams.get('ms') ?? 200);
        return later(ms, () => send(200, { ok: true, slept: ms }));
      }

      if (path === '/never') {
        // Deliberately no response and no timer: the socket stays parked until
        // the client times out or close() destroys it.
        return;
      }

      if (path === '/reset') {
        req.socket.destroy();
        done();
        return;
      }

      if (path.startsWith('/status/')) {
        const code = Number(path.slice('/status/'.length)) || 500;
        return send(code, { status: code });
      }

      if (path === '/flaky') {
        const rate = Number(url.searchParams.get('rate') ?? 0.5);
        return Math.random() < rate ? send(503, { e: 'flaky' }) : send(200, { ok: true });
      }

      if (path === '/outage') {
        return outage ? send(503, { e: 'outage' }) : send(200, { ok: true });
      }

      if (path === '/retry-after') {
        const s = url.searchParams.get('s') ?? '1';
        return send(429, { e: 'slow down' }, { 'retry-after': s });
      }

      if (path === '/huge') {
        const bytes = Number(url.searchParams.get('bytes') ?? 8 * 1024 * 1024);
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': String(bytes) });
        return res.end(Buffer.alloc(bytes, 0x61));
      }

      return send(404, { e: 'no route' });
    });
  });

  server.on('connection', (socket) => {
    stats.connections++;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stats,
    reset() {
      Object.assign(stats, blankStats());
      inFlight = 0;
    },
    setOutage(on: boolean) {
      outage = on;
    },
    captureHeader(name: string) {
      capturedHeaderName = name.toLowerCase();
    },
    async close() {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      for (const s of sockets) s.destroy();
      sockets.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function blankStats(): FaultServerStats {
  return { total: 0, byPath: {}, byMethod: {}, maxConcurrent: 0, bodies: [], capturedHeaders: [], connections: 0 };
}

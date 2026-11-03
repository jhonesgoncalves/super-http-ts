import http from 'http';
import https from 'https';
import { Socket } from 'net';
import { performance } from 'perf_hooks';

export interface ConnectionPoolOptions {
  freeSocketTimeoutMs?: number;
  maxSocketAgeMs?: number;
  keepAliveTimeoutBufferMs?: number;
}

/** Apply idle-only retirement without timers surviving a socket's reuse. */
export function configurePool<T extends http.Agent | https.Agent>(agent: T, options: ConnectionPoolOptions): T {
  const created = new WeakMap<Socket, number>();
  // Node's typings declare keepSocketAlive as void, but the documented native
  // hook returns a boolean controlling whether the free socket is retained.
  const native = agent as unknown as {
    createConnection: (
      opts: http.ClientRequestArgs,
      callback?: (error: Error | null, socket: Socket) => void,
    ) => Socket;
    keepSocketAlive: (socket: Socket) => boolean;
  };
  const create = native.createConnection.bind(agent);
  native.createConnection = (opts, callback) => {
    const socket = create(opts, callback);
    if (socket) created.set(socket, performance.now());
    return socket;
  };
  const keep = native.keepSocketAlive.bind(agent);
  native.keepSocketAlive = (socket) => {
    if (!keep(socket)) return false;
    const born = created.get(socket) ?? performance.now();
    created.set(socket, born);
    const remainingAge =
      options.maxSocketAgeMs === undefined ? Infinity : options.maxSocketAgeMs - (performance.now() - born);
    if (remainingAge <= 0) return false;

    // Honour the upstream hint on Node 20/22 as well as Node 24. The native
    // implementation can already impose a shorter timeout; never extend it.
    const hint = (socket as typeof socket & { _httpMessage?: { res?: { headers?: { 'keep-alive'?: string } } } })
      ._httpMessage?.res?.headers?.['keep-alive'];
    const seconds = hint?.match(/(?:^|,)\s*timeout\s*=\s*(\d+)/i)?.[1];
    const hinted =
      seconds === undefined ? Infinity : Number(seconds) * 1000 - (options.keepAliveTimeoutBufferMs ?? 1000);
    if (hinted <= 0) return false;
    const idle = options.freeSocketTimeoutMs === 0 ? Infinity : options.freeSocketTimeoutMs ?? Infinity;
    const timeout = Math.min(
      socket.timeout && socket.timeout > 0 ? socket.timeout : Infinity,
      idle,
      remainingAge,
      hinted,
    );
    if (Number.isFinite(timeout)) socket.setTimeout(Math.max(1, Math.floor(timeout)));
    return true;
  };
  return agent;
}

export function socketReuse(error: unknown): boolean | undefined {
  const request = (error as { request?: { reusedSocket?: boolean; _currentRequest?: { reusedSocket?: boolean } } })
    ?.request;
  return request?._currentRequest?.reusedSocket ?? request?.reusedSocket;
}

export function reusedSocket(error: unknown): boolean {
  return socketReuse(error) === true;
}

export function isReusedSocketReset(error: unknown): boolean {
  return (error as { code?: string })?.code === 'ECONNRESET' && reusedSocket(error);
}

export function poolSnapshot(agent: http.Agent): { active: number; idle: number; queued: number } {
  const count = (entries: object): number =>
    Object.values(entries).reduce((total, sockets) => total + sockets.length, 0);
  return { active: count(agent.sockets), idle: count(agent.freeSockets), queued: count(agent.requests) };
}

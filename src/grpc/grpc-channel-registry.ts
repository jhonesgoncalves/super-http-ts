import * as http2 from 'http2';

/**
 * Parses a gRPC address string to a canonical HTTP/2 origin.
 *
 * Accepted formats:
 *   - `grpc://host:port`   → `http://host:port`  (insecure)
 *   - `grpcs://host:port`  → `https://host:port` (TLS)
 *   - `host:port`          → `http://host:port`  (insecure)
 *   - `http://...` / `https://...` → passed through
 */
export function resolveOrigin(address: string): string {
  if (address.startsWith('grpcs://')) return 'https://' + address.slice(8);
  if (address.startsWith('grpc://')) return 'http://' + address.slice(7);
  if (address.startsWith('http')) return address;
  return 'http://' + address;
}

interface SessionEntry {
  session: http2.ClientHttp2Session;
  address: string;
  createdAt: number;
}

/**
 * Registry that caches `http2.ClientHttp2Session` instances by address.
 *
 * Each address gets up to `maxSessions` HTTP/2 connections. HTTP/2 multiplexes
 * many concurrent RPCs over a single connection, so 1–2 sessions per address is
 * usually sufficient even under high load.
 *
 * Mirrors the role of `HttpClientFactory` for the HTTP transport: lifetime
 * management and caching in one place.
 */
export class GrpcChannelRegistry {
  private static readonly _registry = new Map<string, SessionEntry[]>();
  private static readonly DEFAULT_MAX_SESSIONS = 2;
  /** How often an idle session is pinged to prove it is still connected. */
  static readonly KEEPALIVE_PING_MS = 30_000;

  /**
   * Returns (or creates) an open HTTP/2 session for the given address.
   * If all cached sessions for this address are closed/destroyed, a new one
   * is created automatically.
   */
  static getSession(address: string, maxSessions = GrpcChannelRegistry.DEFAULT_MAX_SESSIONS): http2.ClientHttp2Session {
    const origin = resolveOrigin(address);
    const entries = GrpcChannelRegistry._registry.get(origin) ?? [];
    const alive = entries.filter((e) => !e.session.destroyed && !e.session.closed);

    if (alive.length > 0) {
      // Round-robin across alive sessions for load distribution
      const idx = Math.floor(Math.random() * alive.length);
      return alive[idx].session;
    }

    // Create new sessions up to the limit
    const toCreate = Math.max(1, maxSessions - alive.length);
    const newEntries: SessionEntry[] = [];

    for (let i = 0; i < toCreate; i++) {
      const session = http2.connect(origin, {
        // Keep sessions alive even when idle
        settings: {
          enablePush: false,
          initialWindowSize: 65535 * 16, // 1 MB initial flow-control window
        },
      });

      session.on('error', () => {
        // Session errors are expected during network disruptions; the registry
        // will create a fresh one on the next call.
      });

      // Detect half-open connections. A NAT or firewall silently dropping the
      // socket leaves the session looking usable, so every call routed to it
      // hangs until its own timeout — pings surface it instead.
      const ping = setInterval(() => {
        if (session.destroyed || session.closed) {
          clearInterval(ping);
          return;
        }
        try {
          session.ping(() => undefined);
        } catch {
          session.destroy();
        }
      }, GrpcChannelRegistry.KEEPALIVE_PING_MS);
      ping.unref?.();
      session.once('close', () => clearInterval(ping));

      newEntries.push({ session, address: origin, createdAt: Date.now() });
    }

    GrpcChannelRegistry._registry.set(origin, [...alive, ...newEntries]);
    return newEntries[0].session;
  }

  /**
   * Gracefully closes all sessions for an address.
   */
  static async closeAddress(address: string): Promise<void> {
    const origin = resolveOrigin(address);
    const entries = GrpcChannelRegistry._registry.get(origin) ?? [];
    await Promise.all(
      entries.map(
        (e) =>
          new Promise<void>((resolve) => {
            if (e.session.destroyed || e.session.closed) return resolve();
            e.session.close(() => resolve());
          }),
      ),
    );
    GrpcChannelRegistry._registry.delete(origin);
  }

  /**
   * Gracefully closes all sessions across all addresses.
   */
  static async closeAll(): Promise<void> {
    const addresses = [...GrpcChannelRegistry._registry.keys()];
    await Promise.all(addresses.map((a) => GrpcChannelRegistry.closeAddress(a)));
  }

  /**
   * Destroys all sessions (immediate, no graceful drain).
   * Useful in tests to reset state between runs.
   */
  static clear(): void {
    for (const entries of GrpcChannelRegistry._registry.values()) {
      for (const e of entries) {
        if (!e.session.destroyed) e.session.destroy();
      }
    }
    GrpcChannelRegistry._registry.clear();
  }

  /** Current number of open sessions across all addresses (for metrics/health). */
  static get sessionCount(): number {
    let count = 0;
    for (const entries of GrpcChannelRegistry._registry.values()) {
      count += entries.filter((e) => !e.session.destroyed && !e.session.closed).length;
    }
    return count;
  }
}

import type { HttpClient } from '../http-client/http.client';

/**
 * A super-http plugin.
 *
 * Plugins are the standard extension point for cross-cutting concerns such as
 * logging, distributed tracing, or custom metrics backends.
 *
 * @example
 * ```ts
 * const MyPlugin: SuperHttpPlugin = {
 *   name: 'my-plugin',
 *   install(client) {
 *     client.on({
 *       onRequest:  (cfg) => console.log(`→ ${cfg.method} ${cfg.url}`),
 *       onResponse: (res) => console.log(`← ${res.status}`),
 *     });
 *   },
 * };
 *
 * client.use(MyPlugin);
 * ```
 */
export interface SuperHttpPlugin {
  /** Unique name — prevents the same plugin being installed twice. */
  name: string;
  /** Called once when the plugin is installed on a client. */
  install(client: HttpClient): void;
}

// ─── Built-in plugins ────────────────────────────────────────────────────────

export interface LoggerPluginOptions {
  /**
   * Log level — maps to `console.debug`, `console.log`, `console.warn`, `console.error`.
   * @defaultValue 'info'
   */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Optional prefix for all log lines. @defaultValue '[super-http]' */
  prefix?: string;
  /** Log request lines. @defaultValue true */
  logRequests?: boolean;
  /** Log response lines. @defaultValue true */
  logResponses?: boolean;
  /** Log resilience events (retry, CB, etc.). @defaultValue true */
  logResilience?: boolean;
}

/**
 * Structured console logger plugin.
 *
 * @example
 * ```ts
 * client.use(LoggerPlugin({ prefix: '[payments-api]', level: 'debug' }))
 * ```
 */
export function LoggerPlugin(options: LoggerPluginOptions = {}): SuperHttpPlugin {
  const {
    level = 'info',
    prefix = '[super-http]',
    logRequests = true,
    logResponses = true,
    logResilience = true,
  } = options;

  const log = console[level] ?? console.log;
  const warn = console.warn;

  return {
    name: 'logger',
    install(client) {
      client.on({
        ...(logRequests && {
          onRequest: (cfg) =>
            log(`${prefix} → ${(cfg.method ?? 'GET').toUpperCase()} ${cfg.url}`),
        }),
        ...(logResponses && {
          onResponse: (res) =>
            log(`${prefix} ← ${res.status} ${res.config?.url ?? ''}`),
          onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`${prefix} ✗ ${msg}`);
          },
        }),
        ...(logResilience && {
          onRetry: ({ attempt, delayMs }) =>
            warn(`${prefix} retry #${attempt + 1} in ${delayMs.toFixed(0)}ms`),
          onCircuitStateChange: ({ from, to, failures }) =>
            warn(`${prefix} circuit ${from} → ${to} (failures: ${failures})`),
          onBulkheadReject: ({ active, queued }) =>
            warn(`${prefix} bulkhead full — active: ${active}, queued: ${queued}`),
          onFallback: ({ error }) =>
            warn(`${prefix} fallback triggered`, error),
          onRateLimitReject: ({ permitLimit, windowMs }) =>
            warn(`${prefix} rate limit hit — ${permitLimit}/${windowMs}ms`),
        }),
      });
    },
  };
}

/**
 * Metrics reporter plugin — logs a metrics summary on a configurable interval.
 *
 * @example
 * ```ts
 * client.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
 * ```
 */
export function MetricsReporterPlugin(options: { intervalMs?: number } = {}): SuperHttpPlugin {
  const { intervalMs = 60_000 } = options;
  return {
    name: 'metrics-reporter',
    install(client) {
      const timer = setInterval(() => {
        const m = client.metrics();
        console.log(
          `[super-http:metrics] requests=${m.requests} success=${m.success} ` +
          `failed=${m.failed} retries=${m.retries} cb_trips=${m.circuitBreakerTrips} ` +
          `avg=${m.avgLatency}ms p95=${m.p95Latency}ms p99=${m.p99Latency}ms`,
        );
      }, intervalMs);
      // Allow process to exit even if the timer is still active
      if (timer.unref) timer.unref();
    },
  };
}

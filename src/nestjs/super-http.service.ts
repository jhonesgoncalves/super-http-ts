import { Injectable, Inject } from '@nestjs/common';
import { HttpClient } from '../http-client/http.client';
import type { HttpClientResponse } from '../models/http.client.response';
import type { MetricsSnapshot } from '../models/metrics';
import type { ResilienceEvents } from '../models/resilience.events';
import type { SuperHttpPlugin } from '../plugins/index';
import { SUPER_HTTP_DEFAULT_CLIENT } from './super-http.constants';

/**
 * Injectable NestJS service that wraps the default `HttpClient` instance.
 *
 * Available when `SuperHttpModule.forRoot()` or `forRootAsync()` is used.
 * Exposes the full `HttpClient` API — all HTTP methods, resilience config,
 * metrics and plugin registration.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class UsersService {
 *   constructor(private readonly http: SuperHttpService) {}
 *
 *   findAll() {
 *     return this.http.get<User[]>('/users');
 *   }
 * }
 * ```
 */
@Injectable()
export class SuperHttpService {
  constructor(
    @Inject(SUPER_HTTP_DEFAULT_CLIENT)
    private readonly client: HttpClient,
  ) {}

  // ─── HTTP methods ─────────────────────────────────────────────────────────

  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<HttpClientResponse<T>> {
    return this.client.get<T>(url, config as never);
  }

  post<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<HttpClientResponse<T>> {
    return this.client.post<T>(url, data, config as never);
  }

  put<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<HttpClientResponse<T>> {
    return this.client.put<T>(url, data, config as never);
  }

  patch<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<HttpClientResponse<T>> {
    return this.client.patch<T>(url, data, config as never);
  }

  delete<T = unknown>(url: string, config?: Record<string, unknown>): Promise<HttpClientResponse<T>> {
    return this.client.delete<T>(url, config as never);
  }

  // ─── Observability ────────────────────────────────────────────────────────

  /**
   * Returns a point-in-time metrics snapshot.
   *
   * @example
   * ```ts
   * const m = this.http.metrics()
   * logger.log({ p99: m.p99Latency, retries: m.retries })
   * ```
   */
  metrics(): MetricsSnapshot {
    return this.client.metrics();
  }

  /** Resets all accumulated metrics. */
  resetMetrics(): this {
    this.client.resetMetrics();
    return this;
  }

  /** Registers an observability hooks. */
  on(events: ResilienceEvents): this {
    this.client.on(events);
    return this;
  }

  /** Installs a plugin. */
  use(plugin: SuperHttpPlugin): this {
    this.client.use(plugin);
    return this;
  }

  /**
   * Exposes the underlying `HttpClient` for advanced use cases
   * (e.g. configuring resilience policies after module init).
   *
   * @example
   * ```ts
   * this.http.instance
   *   .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
   *   .retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
   * ```
   */
  get instance(): HttpClient {
    return this.client;
  }
}

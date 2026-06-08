import type { ModuleMetadata, Type } from '@nestjs/common';
import type { CreateClientOptions } from '../presets/index';

// ─── Module options ───────────────────────────────────────────────────────────

/**
 * Options for `SuperHttpModule.forRoot()`.
 *
 * Accepts all options from {@link CreateClientOptions} — `baseURL`, `preset`,
 * `pool`, `headers`, `timeout`, etc.
 */
export type SuperHttpModuleOptions = CreateClientOptions;

/**
 * Named client definition used in `SuperHttpModule.forFeature()`.
 *
 * @example
 * ```ts
 * SuperHttpModule.forFeature([
 *   { name: 'PAYMENTS', baseURL: 'https://payments.internal', preset: 'resilient-api' },
 *   { name: 'CATALOG',  baseURL: 'https://catalog.internal',  preset: 'high-throughput' },
 * ])
 * ```
 */
export interface SuperHttpFeatureOptions extends CreateClientOptions {
  /** Unique name used to identify this client. Passed to `@InjectSuperHttp(name)`. */
  name: string;
}

// ─── Async options ────────────────────────────────────────────────────────────

/** Factory interface for async module configuration. */
export interface SuperHttpOptionsFactory {
  createSuperHttpOptions(): Promise<SuperHttpModuleOptions> | SuperHttpModuleOptions;
}

/**
 * Options for `SuperHttpModule.forRootAsync()`.
 *
 * @example
 * ```ts
 * // With ConfigService
 * SuperHttpModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (config: ConfigService) => ({
 *     baseURL: config.get('API_BASE_URL'),
 *     preset: 'resilient-api',
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 */
export interface SuperHttpModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: unknown[]) => Promise<SuperHttpModuleOptions> | SuperHttpModuleOptions;
  useClass?: Type<SuperHttpOptionsFactory>;
  useExisting?: Type<SuperHttpOptionsFactory>;
  inject?: unknown[];
}

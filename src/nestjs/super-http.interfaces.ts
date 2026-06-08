import type { ModuleMetadata, Type } from '@nestjs/common';
import type { CreateClientOptions } from '../presets/index';
import type { GrpcClientConfig } from '../models/grpc.client.config';
import type { ServiceDefinition, ServiceMethods } from '../grpc/service-definition';

// ─── Module options ───────────────────────────────────────────────────────────

/**
 * Options for `SuperHttpModule.forRoot()`.
 *
 * Accepts all options from {@link CreateClientOptions} — `baseURL`, `preset`,
 * `pool`, `headers`, `timeout`, etc.
 */
export type SuperHttpModuleOptions = CreateClientOptions;

/**
 * Named HTTP client definition used in `SuperHttpModule.forFeature()`.
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
  grpc?: false;
}

/**
 * Named gRPC client definition used in `SuperHttpModule.forFeature()`.
 *
 * Mix HTTP and gRPC clients in the same `forFeature([...])` call.
 * Both are injected with the same `@InjectSuperHttp('NAME')` decorator.
 *
 * @example
 * ```ts
 * SuperHttpModule.forFeature([
 *   { name: 'PAYMENTS_HTTP', baseURL: 'https://payments.internal', preset: 'resilient-api' },
 *   { name: 'USER_GRPC',     grpc: true, address: 'user-service:50051',
 *     service: UserServiceDef, preset: 'resilient-api' },
 * ])
 * ```
 */
export interface SuperHttpGrpcFeatureOptions extends GrpcClientConfig {
  /** Unique name used to identify this client. Passed to `@InjectSuperHttp(name)`. */
  name: string;
  /** Must be `true` to select the gRPC client path. */
  grpc: true;
  /** Remote address — `grpc://host:port`, `grpcs://host:port`, or `host:port`. */
  address: string;
  /** Service definition created with `defineService()` from `super-http/grpc`. */
  service: ServiceDefinition<ServiceMethods>;
}

/** Union of HTTP and gRPC named client options, discriminated by `grpc`. */
export type AnyFeatureOptions = SuperHttpFeatureOptions | SuperHttpGrpcFeatureOptions;

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

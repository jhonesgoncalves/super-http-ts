import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import { HttpClientFactory } from '../http-client/http.factory';
import { createClient } from '../presets/index';
import { createGrpcClient } from '../grpc/grpc-client';
import { SuperHttpService } from './super-http.service';
import { SUPER_HTTP_DEFAULT_CLIENT, SUPER_HTTP_MODULE_OPTIONS, getSuperHttpClientToken } from './super-http.constants';
import type {
  SuperHttpModuleOptions,
  SuperHttpModuleAsyncOptions,
  SuperHttpFeatureOptions,
  SuperHttpOptionsFactory,
  AnyFeatureOptions,
} from './super-http.interfaces';

/**
 * NestJS dynamic module for super-http.
 *
 * ## Quick start
 *
 * ```ts
 * // app.module.ts
 * @Module({
 *   imports: [
 *     SuperHttpModule.forRoot({
 *       baseURL: 'https://api.example.com',
 *       preset: 'resilient-api',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * Then inject `SuperHttpService` or use `@InjectSuperHttp()`:
 *
 * ```ts
 * @Injectable()
 * class UsersService {
 *   constructor(private readonly http: SuperHttpService) {}
 * }
 * ```
 *
 * ## Multiple clients
 *
 * ```ts
 * SuperHttpModule.forFeature([
 *   { name: 'PAYMENTS', baseURL: 'https://payments.internal', preset: 'resilient-api' },
 *   { name: 'CATALOG',  baseURL: 'https://catalog.internal',  preset: 'high-throughput' },
 * ])
 * ```
 *
 * Then:
 *
 * ```ts
 * @InjectSuperHttp('PAYMENTS') private readonly payments: HttpClient
 * ```
 */
@Global()
@Module({})
export class SuperHttpModule {
  // ─── forRoot ───────────────────────────────────────────────────────────────

  /**
   * Registers a single (default) `HttpClient` globally.
   *
   * @example
   * ```ts
   * SuperHttpModule.forRoot({
   *   baseURL: 'https://api.example.com',
   *   preset: 'resilient-api',
   *   headers: { 'X-App': 'my-service' },
   * })
   * ```
   */
  static forRoot(options: SuperHttpModuleOptions): DynamicModule {
    const clientProvider: Provider = {
      provide: SUPER_HTTP_DEFAULT_CLIENT,
      useFactory: () => createClient(options),
    };

    return {
      module: SuperHttpModule,
      providers: [clientProvider, SuperHttpService],
      exports: [clientProvider, SuperHttpService],
    };
  }

  // ─── forRootAsync ──────────────────────────────────────────────────────────

  /**
   * Registers the default client with async configuration (e.g. `ConfigService`).
   *
   * @example
   * ```ts
   * SuperHttpModule.forRootAsync({
   *   imports: [ConfigModule],
   *   useFactory: (config: ConfigService) => ({
   *     baseURL: config.get('API_BASE_URL'),
   *     preset: config.get('API_PRESET') ?? 'resilient-api',
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(asyncOptions: SuperHttpModuleAsyncOptions): DynamicModule {
    const asyncProviders = SuperHttpModule.createAsyncProviders(asyncOptions);

    const clientProvider: Provider = {
      provide: SUPER_HTTP_DEFAULT_CLIENT,
      useFactory: (options: SuperHttpModuleOptions) => createClient(options),
      inject: [SUPER_HTTP_MODULE_OPTIONS],
    };

    return {
      module: SuperHttpModule,
      imports: asyncOptions.imports ?? [],
      providers: [...asyncProviders, clientProvider, SuperHttpService],
      exports: [clientProvider, SuperHttpService],
    };
  }

  // ─── forFeature ────────────────────────────────────────────────────────────

  /**
   * Registers one or more named `HttpClient` instances for a feature module.
   * Named clients are injected via `@InjectSuperHttp('NAME')`.
   *
   * This method is **not global** — it must be imported in each module that
   * needs the named clients.
   *
   * @example
   * ```ts
   * // payments.module.ts
   * @Module({
   *   imports: [
   *     SuperHttpModule.forFeature([
   *       { name: 'PAYMENTS', baseURL: 'https://payments.internal', preset: 'resilient-api' },
   *     ]),
   *   ],
   * })
   * export class PaymentsModule {}
   * ```
   */
  static forFeature(clients: AnyFeatureOptions[]): DynamicModule {
    const providers: Provider[] = clients.map((opts) => ({
      provide: getSuperHttpClientToken(opts.name),
      useFactory: () => {
        if (opts.grpc === true) {
          // gRPC client — no HttpClientFactory involved
          return createGrpcClient(opts.service, opts.address, opts);
        }
        // HTTP client — each named client gets its own isolated instance
        HttpClientFactory.clear();
        return createClient(opts as SuperHttpFeatureOptions);
      },
    }));

    return {
      module: SuperHttpModule,
      providers,
      exports: providers,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private static createAsyncProviders(asyncOptions: SuperHttpModuleAsyncOptions): Provider[] {
    if (asyncOptions.useFactory) {
      return [
        {
          provide: SUPER_HTTP_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: (asyncOptions.inject as never[]) ?? [],
        },
      ];
    }

    if (asyncOptions.useClass) {
      return [
        {
          provide: SUPER_HTTP_MODULE_OPTIONS,
          useFactory: async (factory: SuperHttpOptionsFactory) => factory.createSuperHttpOptions(),
          inject: [asyncOptions.useClass],
        },
        { provide: asyncOptions.useClass, useClass: asyncOptions.useClass },
      ];
    }

    if (asyncOptions.useExisting) {
      return [
        {
          provide: SUPER_HTTP_MODULE_OPTIONS,
          useFactory: async (factory: SuperHttpOptionsFactory) => factory.createSuperHttpOptions(),
          inject: [asyncOptions.useExisting],
        },
      ];
    }

    return [];
  }
}

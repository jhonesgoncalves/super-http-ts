/**
 * super-http NestJS integration.
 *
 * @example
 * ```ts
 * import { SuperHttpModule, SuperHttpService, InjectSuperHttp } from 'super-http/nestjs'
 * ```
 */

export { SuperHttpModule } from './super-http.module';
export { SuperHttpService } from './super-http.service';
export { InjectSuperHttp } from './super-http.decorators';
export { getSuperHttpClientToken } from './super-http.constants';
export type {
  SuperHttpModuleOptions,
  SuperHttpModuleAsyncOptions,
  SuperHttpFeatureOptions,
  SuperHttpOptionsFactory,
} from './super-http.interfaces';

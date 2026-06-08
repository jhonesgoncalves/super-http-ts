import { Inject } from '@nestjs/common';
import { SUPER_HTTP_DEFAULT_CLIENT, getSuperHttpClientToken } from './super-http.constants';

/**
 * Injects an `HttpClient` instance created by `SuperHttpModule`.
 *
 * - Without argument → injects the **default** client (registered via `forRoot`)
 * - With a name → injects a **named** client (registered via `forFeature`)
 *
 * @example
 * ```ts
 * // Default client
 * @Injectable()
 * export class UsersService {
 *   constructor(
 *     @InjectSuperHttp() private readonly http: HttpClient,
 *   ) {}
 * }
 *
 * // Named client
 * @Injectable()
 * export class PaymentsService {
 *   constructor(
 *     @InjectSuperHttp('PAYMENTS') private readonly http: HttpClient,
 *   ) {}
 * }
 * ```
 */
export const InjectSuperHttp = (name?: string): ParameterDecorator =>
  Inject(name ? getSuperHttpClientToken(name) : SUPER_HTTP_DEFAULT_CLIENT);

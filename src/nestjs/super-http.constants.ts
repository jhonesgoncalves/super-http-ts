/** Injection token for the default SuperHttp client. */
export const SUPER_HTTP_DEFAULT_CLIENT = 'SUPER_HTTP_DEFAULT_CLIENT';

/** Injection token for the module options. */
export const SUPER_HTTP_MODULE_OPTIONS = 'SUPER_HTTP_MODULE_OPTIONS';

/**
 * Returns the injection token for a named SuperHttp client.
 *
 * @example
 * ```ts
 * getSuperHttpClientToken('PAYMENTS') // → 'SUPER_HTTP_CLIENT_PAYMENTS'
 * ```
 */
export const getSuperHttpClientToken = (name: string): string => `SUPER_HTTP_CLIENT_${name.toUpperCase()}`;

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SuperHttpOptionsFactory, SuperHttpModuleOptions } from 'super-http/nestjs';

/**
 * Factory class for super-http configuration.
 *
 * Demonstrates the `useClass` pattern for async module config —
 * ideal when setup logic is complex enough to warrant its own class.
 *
 * Registered via `SuperHttpModule.forRootAsync({ useClass: SuperHttpConfigService })`.
 */
@Injectable()
export class SuperHttpConfigService implements SuperHttpOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createSuperHttpOptions(): SuperHttpModuleOptions {
    return {
      baseURL: this.config.get<string>('JSONPLACEHOLDER_URL', 'https://jsonplaceholder.typicode.com'),
      preset: 'resilient-api',
      headers: {
        'X-App-Name': 'super-http-nestjs-example',
        'X-App-Version': '1.0.0',
      },
      pool: {
        maxSockets:     Number(this.config.get('HTTP_MAX_SOCKETS',  '100')),
        timeout:        Number(this.config.get('HTTP_TIMEOUT_MS',   '15000')),
        keepAlive:      true,
        keepAliveMsecs: 1000,
      },
    };
  }
}

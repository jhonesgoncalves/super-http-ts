import { Module } from '@nestjs/common';
import { SuperHttpModule } from 'super-http/nestjs';
import { CatalogServiceDef, CATALOG_GRPC_PORT } from './catalog-service.def';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [
    /**
     * Register the CatalogService gRPC client.
     *
     * `grpc: true` routes forFeature to createGrpcClient() instead of
     * createClient(). The client is injected the same way as HTTP clients:
     *   @InjectSuperHttp('CATALOG_GRPC')
     */
    SuperHttpModule.forFeature([
      {
        name:    'CATALOG_GRPC',
        grpc:    true,
        address: `http://localhost:${CATALOG_GRPC_PORT}`,
        service: CatalogServiceDef,
        preset:  'resilient-api',
        // Fine-tune for a local service — tighter timeouts, fewer retries
        timeoutMs: 5_000,
        retries:   2,
      },
    ]),
  ],
  controllers: [CatalogController],
  providers:   [CatalogService],
  exports:     [CatalogService],
})
export class CatalogModule {}

import {
  Controller, Get, Param, Query, Logger,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { Product } from './catalog-service.def';

/**
 * CatalogController — standard HTTP REST endpoints.
 *
 * Every request here translates to one or more gRPC calls to the
 * CatalogService backend via CatalogService (the NestJS provider).
 *
 * From the client's perspective this is a normal REST API:
 *   GET /catalog             → list products (optionally filtered)
 *   GET /catalog/search      → full-text search
 *   GET /catalog/metrics     → gRPC client metrics (circuit breaker state, p99, etc.)
 *   GET /catalog/:id         → get single product
 */
@Controller('catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /catalog
   * GET /catalog?category=electronics
   * GET /catalog?inStock=true&limit=5
   *
   * Internally calls listProducts via gRPC server streaming.
   * The stream is consumed server-side and returned as a JSON array.
   */
  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('inStock')  inStock?: string,
    @Query('limit')    limit?: string,
  ): Promise<Product[]> {
    this.logger.log(`GET /catalog — category=${category ?? '*'} inStock=${inStock} limit=${limit}`);

    return this.catalogService.findAll({
      category,
      inStock: inStock !== undefined ? inStock === 'true' : undefined,
      limit:   limit   !== undefined ? Number(limit)     : undefined,
    });
  }

  /**
   * GET /catalog/search?q=keyboard
   * GET /catalog/search?q=desk&limit=3
   *
   * Internally calls searchProducts via gRPC server streaming.
   */
  @Get('search')
  async search(
    @Query('q')     query = '',
    @Query('limit') limit?: string,
  ): Promise<Product[]> {
    this.logger.log(`GET /catalog/search?q="${query}"`);
    return this.catalogService.search(query, limit ? Number(limit) : 10);
  }

  /**
   * GET /catalog/metrics
   *
   * Exposes the gRPC client's live metrics:
   *   requests, success, failed, retries, circuitBreakerTrips, p50/p99 latency
   */
  @Get('metrics')
  grpcMetrics() {
    return this.catalogService.grpcMetrics();
  }

  /**
   * GET /catalog/:id
   *
   * Internally calls getProduct via gRPC unary call.
   * Returns 404 if the product doesn't exist (GrpcError.code = 'not_found').
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Product> {
    this.logger.log(`GET /catalog/${id}`);
    return this.catalogService.findOne(id);
  }
}

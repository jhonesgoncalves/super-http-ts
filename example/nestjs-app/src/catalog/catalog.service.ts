import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectSuperHttp } from 'super-http/nestjs';
import type { GrpcClient } from 'super-http/grpc';
import { GrpcError } from 'super-http/grpc';
import type { CatalogServiceDef, Product } from './catalog-service.def';

/**
 * CatalogService — bridges HTTP endpoints to the CatalogService gRPC backend.
 *
 * The gRPC client is injected exactly like an HTTP client — same decorator,
 * same DI token pattern. The resilience pipeline (circuit breaker, retry,
 * bulkhead) is active on every RPC call transparently.
 */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    /**
     * GrpcClient<typeof CatalogServiceDef> is fully typed:
     *   client.getProduct({ id }) → Promise<Product>
     *   client.listProducts({ category }) → AsyncIterable<Product>
     *   client.searchProducts({ query }) → AsyncIterable<Product>
     */
    @InjectSuperHttp('CATALOG_GRPC')
    private readonly catalog: GrpcClient<typeof CatalogServiceDef>,
  ) {}

  /**
   * Fetch a single product by ID via gRPC unary call.
   * Maps gRPC not_found → HTTP 404 NotFoundException.
   */
  async findOne(id: string): Promise<Product> {
    try {
      return await this.catalog.getProduct({ id });
    } catch (err) {
      if (err instanceof GrpcError && err.code === 'not_found') {
        throw new NotFoundException(`Product "${id}" not found`);
      }
      this.logger.error(`getProduct(${id}) failed: ${String(err)}`);
      throw err;
    }
  }

  /**
   * List all products matching an optional filter.
   * Collects the server stream into an array so the HTTP response is a
   * standard JSON array — no SSE or chunked streaming needed at the HTTP layer.
   */
  async findAll(options: { category?: string; inStock?: boolean; limit?: number } = {}): Promise<Product[]> {
    const products: Product[] = [];

    try {
      for await (const product of this.catalog.listProducts(options)) {
        products.push(product);
      }
    } catch (err) {
      this.logger.error(`listProducts() failed: ${String(err)}`);
      throw err;
    }

    return products;
  }

  /**
   * Full-text search — streams matching products from gRPC, returns as array.
   */
  async search(query: string, limit = 10): Promise<Product[]> {
    const results: Product[] = [];

    try {
      for await (const product of this.catalog.searchProducts({ query, limit })) {
        results.push(product);
      }
    } catch (err) {
      this.logger.error(`searchProducts("${query}") failed: ${String(err)}`);
      throw err;
    }

    return results;
  }

  /**
   * Returns the gRPC client's metrics snapshot — useful for health/monitoring.
   */
  grpcMetrics() {
    return this.catalog.metrics();
  }
}

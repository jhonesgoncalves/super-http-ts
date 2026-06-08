/**
 * CatalogService — gRPC service definition (TypeScript-first, no .proto)
 *
 * This is the single source of truth for the gRPC contract between
 * the NestJS app and the CatalogService gRPC backend.
 */

import { defineService, unary, serverStream } from 'super-http/grpc';

export const CATALOG_GRPC_PORT = 50053;

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  active: boolean;
}

export interface GetProductRequest {
  id: string;
}

export interface ListProductsRequest {
  category?: string;
  inStock?: boolean;
  limit?: number;
}

export interface SearchProductsRequest {
  query: string;
  limit?: number;
}

// ─── Service definition ───────────────────────────────────────────────────────

export const CatalogServiceDef = defineService('CatalogService', {
  /** Fetch a single product by ID */
  getProduct: unary<GetProductRequest, Product>(),

  /** Stream all products matching an optional filter */
  listProducts: serverStream<ListProductsRequest, Product>(),

  /** Full-text search — streams matching products */
  searchProducts: serverStream<SearchProductsRequest, Product>(),
});

/**
 * Mock CatalogService gRPC server (HTTP/2 · Connect-RPC JSON)
 *
 * Stands in for a real CatalogService backend so the NestJS example
 * runs standalone without any external infrastructure.
 *
 * Started automatically by main.ts before the NestJS app boots.
 */

import * as http2 from 'http2';

export const CATALOG_GRPC_PORT = 50053;

// ─── In-memory catalog ───────────────────────────────────────────────────────

const PRODUCTS = [
  { id: 'p1', name: 'Notebook Pro 15',   description: 'High-performance laptop for developers', price: 8999.90, stock: 12, category: 'electronics', active: true  },
  { id: 'p2', name: 'Wireless Mouse',    description: 'Ergonomic mouse with silent click',       price:  149.90, stock: 85, category: 'electronics', active: true  },
  { id: 'p3', name: 'Mechanical Keyboard',description: 'TKL mechanical keyboard, brown switches', price:  599.90, stock: 40, category: 'electronics', active: true  },
  { id: 'p4', name: 'Standing Desk',     description: 'Electric height-adjustable desk 160cm',   price: 3299.00, stock:  5, category: 'furniture',   active: true  },
  { id: 'p5', name: 'Ergonomic Chair',   description: 'Lumbar support mesh chair',               price: 2199.00, stock:  8, category: 'furniture',   active: true  },
  { id: 'p6', name: 'Monitor 4K 27"',    description: '4K IPS monitor, 144Hz',                   price: 3499.90, stock: 15, category: 'electronics', active: true  },
  { id: 'p7', name: 'USB-C Hub 10-in-1', description: '10-port USB-C hub with 4K HDMI',          price:  299.90, stock: 60, category: 'electronics', active: true  },
  { id: 'p8', name: 'Vintage Desk Lamp', description: 'Adjustable arm LED desk lamp',            price:  189.90, stock:  0, category: 'furniture',   active: false },
];

// ─── Envelope helpers ────────────────────────────────────────────────────────

function encodeEnvelope(data: object, flags = 0x00): Buffer {
  const body = Buffer.from(JSON.stringify(data), 'utf-8');
  const header = Buffer.allocUnsafe(5);
  header[0] = flags;
  header.writeUInt32BE(body.length, 1);
  return Buffer.concat([header, body]);
}

function endStreamEnvelope(): Buffer {
  const buf = Buffer.allocUnsafe(5);
  buf[0] = 0x02;
  buf.writeUInt32BE(0, 1);
  return buf;
}

function readBody(stream: http2.ServerHttp2Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end',  () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function reply(stream: http2.ServerHttp2Stream, status: number, body: object): void {
  stream.respond({ ':status': status, 'content-type': 'application/connect+json' });
  stream.end(JSON.stringify(body));
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleGetProduct(stream: http2.ServerHttp2Stream, body: Buffer): Promise<void> {
  const { id } = JSON.parse(body.toString()) as { id: string };
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) {
    return reply(stream, 404, { code: 'not_found', message: `Product "${id}" not found` });
  }
  reply(stream, 200, product);
}

async function handleListProducts(stream: http2.ServerHttp2Stream, body: Buffer): Promise<void> {
  const filter = JSON.parse(body.toString()) as { category?: string; inStock?: boolean; limit?: number };
  stream.respond({ ':status': 200, 'content-type': 'application/connect+json' });

  const results = PRODUCTS
    .filter(p => {
      if (filter.category !== undefined && p.category !== filter.category) return false;
      if (filter.inStock  !== undefined && filter.inStock && p.stock <= 0)  return false;
      return true;
    })
    .slice(0, filter.limit ?? 100);

  for (const product of results) {
    await new Promise(r => setTimeout(r, 10)); // simulate network pacing
    stream.write(encodeEnvelope(product));
  }
  stream.write(endStreamEnvelope());
  stream.end();
}

async function handleSearchProducts(stream: http2.ServerHttp2Stream, body: Buffer): Promise<void> {
  const { query, limit } = JSON.parse(body.toString()) as { query: string; limit?: number };
  stream.respond({ ':status': 200, 'content-type': 'application/connect+json' });

  const q = query.toLowerCase();
  const results = PRODUCTS
    .filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    .slice(0, limit ?? 10);

  for (const product of results) {
    stream.write(encodeEnvelope(product));
  }
  stream.write(endStreamEnvelope());
  stream.end();
}

// ─── Router ──────────────────────────────────────────────────────────────────

const ROUTES: Record<string, (s: http2.ServerHttp2Stream, b: Buffer) => Promise<void>> = {
  '/CatalogService/getProduct':    handleGetProduct,
  '/CatalogService/listProducts':  handleListProducts,
  '/CatalogService/searchProducts': handleSearchProducts,
};

// ─── Server factory ──────────────────────────────────────────────────────────

export function createCatalogGrpcServer(): http2.Http2Server {
  const server = http2.createServer();

  server.on('stream', async (stream, headers) => {
    const path = String(headers[':path'] ?? '');
    const handler = ROUTES[path];

    if (!handler) {
      stream.respond({ ':status': 404, 'content-type': 'application/connect+json' });
      stream.end(JSON.stringify({ code: 'not_found', message: `No handler for ${path}` }));
      return;
    }

    try {
      const body = await readBody(stream);
      await handler(stream, body);
    } catch (err) {
      if (!stream.destroyed) {
        stream.respond({ ':status': 500, 'content-type': 'application/connect+json' });
        stream.end(JSON.stringify({ code: 'internal', message: String(err) }));
      }
    }
  });

  server.on('error', (err) => {
    // Log but don't crash — registry will create a new session on next call
    console.error('[CatalogGrpcServer] error:', err.message);
  });

  return server;
}

export function startCatalogGrpcServer(): Promise<http2.Http2Server> {
  return new Promise((resolve, reject) => {
    const server = createCatalogGrpcServer();
    server.listen(CATALOG_GRPC_PORT, () => {
      console.log(`[CatalogGrpcServer] HTTP/2 mock server on :${CATALOG_GRPC_PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

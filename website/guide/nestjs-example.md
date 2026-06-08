# NestJS Example Application

A complete, production-style NestJS application demonstrating every super-http
integration pattern in a real context. Use it as a reference implementation or
starting point for your own project.

**Source**: [`example/nestjs-app/`](https://github.com/jhonesgoncalves/super-http-ts/tree/main/example/nestjs-app)

---

## What it demonstrates

| Pattern | Where |
|---|---|
| `SuperHttpModule.forRootAsync` + `useClass` | `src/app.module.ts` |
| `SuperHttpOptionsFactory` implementation | `src/config/super-http.config.ts` |
| Default `SuperHttpService` injection | `src/users/users.service.ts` |
| Named clients with `SuperHttpModule.forFeature` | `src/posts/posts.module.ts` |
| `@InjectSuperHttp('NAME')` decorator | `src/posts/posts.service.ts` |
| Per-request policy on mutations | `src/posts/posts.service.ts` |
| Live metrics health endpoint | `src/health/health.controller.ts` |
| Unit tests with mock providers | `**/*.spec.ts` |
| Integration (e2e) tests | `test/app.e2e-spec.ts` |

---

## Module dependency diagram

How the NestJS modules are wired together. `SuperHttpModule` is `@Global()` —
the default `SuperHttpService` is available everywhere once registered in `AppModule`.

```mermaid
graph TD
    AppModule -->|"forRootAsync(useClass)"| SuperHttpModule
    AppModule --> UsersModule
    AppModule --> PostsModule
    AppModule --> HealthModule

    SuperHttpModule -->|"@Global() — provides"| SuperHttpService

    UsersModule -->|injects| SuperHttpService
    HealthModule -->|injects| SuperHttpService

    PostsModule -->|"forFeature([POSTS, COMMENTS])"| PostsSuperHttpModule["SuperHttpModule<br/>(feature)"]
    PostsSuperHttpModule -->|provides| PostsClient["HttpClient<br/>POSTS"]
    PostsSuperHttpModule -->|provides| CommentsClient["HttpClient<br/>COMMENTS"]

    PostsService -->|"@InjectSuperHttp('POSTS')"| PostsClient
    PostsService -->|"@InjectSuperHttp('COMMENTS')"| CommentsClient
```

---

## HTTP client topology

Each client has its own independent connection pool, circuit breaker, retry engine,
and bulkhead. Failures in one client never affect the others.

```mermaid
graph LR
    subgraph SG1[Default client - resilient-api]
        SHS[SuperHttpService] --> Pool1[Pool 100 sockets]
        Pool1 --> CB1[Circuit Breaker]
        CB1 --> Retry1[Retry x3]
        Retry1 --> BH1[Bulkhead 50]
    end

    subgraph SG2[POSTS client - high-throughput]
        PC[HttpClient POSTS] --> Pool2[Pool 200 sockets]
        Pool2 --> Retry2[Retry x1]
    end

    subgraph SG3[COMMENTS client - resilient-api]
        CC[HttpClient COMMENTS] --> Pool3[Pool 100 sockets]
        Pool3 --> CB3[Circuit Breaker]
        CB3 --> Retry3[Retry x3]
        Retry3 --> BH3[Bulkhead 50]
    end

    BH1 --> API[JSONPlaceholder]
    Retry2 --> API
    BH3 --> API
```

---

## Request lifecycle

`GET /api/posts/:id/with-comments` fetches post data and comments **in parallel**
from two independent clients. Both requests run through their own resilience pipelines.

```mermaid
sequenceDiagram
    participant C as HTTP Client
    participant Ctrl as PostsController
    participant Svc as PostsService
    participant BP as POSTS pipeline
    participant CP as COMMENTS pipeline
    participant API as JSONPlaceholder

    C->>Ctrl: GET /api/posts/1/with-comments
    Ctrl->>Svc: findWithComments(1)

    par Parallel fetch
        Svc->>BP: postsClient.get('/posts/1')
        BP->>API: GET /posts/1
        API-->>BP: 200 OK { post }
        BP-->>Svc: { data: post }
    and
        Svc->>CP: commentsClient.get('/posts/1/comments')
        CP->>API: GET /posts/1/comments
        API-->>CP: 200 OK [comments]
        CP-->>Svc: { data: comments[] }
    end

    Svc-->>Ctrl: { ...post, comments }
    Ctrl-->>C: 200 { id, title, body, comments[] }
```

---

## Circuit breaker state machine

The COMMENTS client uses a circuit breaker to avoid waiting for a down service.
When it trips, requests fail immediately at ~1ms instead of waiting for a timeout.

```mermaid
stateDiagram-v2
    [*] --> Closed

    Closed --> Open : 10 consecutive failures
    Open --> HalfOpen : 10 s timeout elapsed
    HalfOpen --> Closed : 3 consecutive successes
    HalfOpen --> Open : any failure

    note right of Closed
        Normal operation.
        Failures are counted.
    end note

    note right of Open
        Requests fail immediately.
        No network call made.
        p99 latency ≈ 1ms.
    end note

    note right of HalfOpen
        One probe allowed.
        Success resets breaker.
    end note
```

---

## Retry strategy

Both the default client and the COMMENTS client use **exponential jitter** retry.
Each attempt waits a random delay within a growing window — this prevents
thundering-herd storms when an upstream recovers.

```mermaid
sequenceDiagram
    participant S as Service
    participant R as Retry engine
    participant U as Upstream

    S->>R: request
    R->>U: attempt 1
    U-->>R: 503 Unavailable
    Note over R: wait ~47ms (jitter)
    R->>U: attempt 2
    U-->>R: 503 Unavailable
    Note over R: wait ~183ms (jitter)
    R->>U: attempt 3
    U-->>R: 200 OK
    R-->>S: success ✓
```

---

## Metrics flow

Every request updates the in-memory `MetricsCollector`. The `GET /health` endpoint
exposes a live snapshot — no external monitoring required for basic observability.

```mermaid
flowchart LR
    Req["Request"] --> MC["MetricsCollector"]
    MC --> Succeed{success?}
    Succeed -->|yes| RS["recordSuccess\nrecordLatency"]
    Succeed -->|no| RF["recordFailure"]
    Retry["retry fired"] --> RR["recordRetry"]
    CBTrip["circuit trips"] --> RT["recordCBTrip"]
    BHFull["bulkhead full"] --> RB["recordBHReject"]

    RS & RF & RR & RT & RB --> Snap["MetricsSnapshot"]
    Snap --> Health["GET /api/health\n{ requests, failed,\n  p99Latency, ... }"]
```

---

## Project structure

```
example/nestjs-app/
├── src/
│   ├── app.module.ts               ← forRootAsync + ConfigModule
│   ├── app.controller.ts           ← GET /
│   ├── config/
│   │   └── super-http.config.ts    ← SuperHttpOptionsFactory (env vars)
│   │
│   ├── users/                      ← default SuperHttpService client
│   │   ├── users.module.ts
│   │   ├── users.controller.ts     ← GET / POST / PUT / DELETE /users
│   │   ├── users.service.ts        ← injects SuperHttpService
│   │   ├── users.service.spec.ts   ← unit tests (mocked)
│   │   ├── users.controller.spec.ts
│   │   └── dto/
│   │       └── create-user.dto.ts  ← @IsString / @IsEmail decorators
│   │
│   ├── posts/                      ← two named clients (POSTS + COMMENTS)
│   │   ├── posts.module.ts         ← forFeature([POSTS, COMMENTS])
│   │   ├── posts.controller.ts     ← GET / POST /posts, with-comments
│   │   ├── posts.service.ts        ← @InjectSuperHttp('POSTS') + ('COMMENTS')
│   │   └── posts.service.spec.ts
│   │
│   └── health/
│       ├── health.module.ts
│       ├── health.controller.ts    ← GET /health (live metrics)
│       └── health.controller.spec.ts
│
├── test/
│   └── app.e2e-spec.ts             ← 14 integration tests vs JSONPlaceholder
│
├── package.json
├── tsconfig.json                   ← emitDecoratorMetadata: true (required)
└── README.md
```

---

## Quick start

```bash
cd example/nestjs-app

# Install dependencies
npm install

# Start in development mode
npm run start:dev

# Run unit tests (28 tests, no network)
npm test

# Run integration tests (14 tests, requires internet)
npm run test:e2e
```

### Available endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api` | Welcome |
| `GET` | `/api/health` | Live HTTP client metrics |
| `GET` | `/api/users` | List all users |
| `GET` | `/api/users/:id` | Get user by ID |
| `POST` | `/api/users` | Create user |
| `PUT` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |
| `GET` | `/api/posts` | List all posts |
| `GET` | `/api/posts/:id` | Get post by ID |
| `GET` | `/api/posts/:id/with-comments` | Post + comments (parallel fetch) |
| `POST` | `/api/posts` | Create post |

---

## Key patterns explained

### 1. `forRootAsync` + `useClass` — config from environment

The root module registers a **global** default client using a factory class that
reads environment variables via `ConfigService`. This is the recommended pattern
for production apps.

```ts
// app.module.ts
SuperHttpModule.forRootAsync({
  imports:  [ConfigModule],   // ← make ConfigService available to the factory
  useClass: SuperHttpConfigService,
})
```

```ts
// config/super-http.config.ts
@Injectable()
export class SuperHttpConfigService implements SuperHttpOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createSuperHttpOptions(): SuperHttpModuleOptions {
    return {
      baseURL: this.config.get('JSONPLACEHOLDER_URL', 'https://jsonplaceholder.typicode.com'),
      preset: 'resilient-api',
      headers: { 'X-App-Name': 'my-app' },
    }
  }
}
```

::: tip Why `useClass` over `useFactory`?
`useClass` is better for complex configs — the factory class can have its own
injected dependencies and is trivially testable in isolation.
:::

---

### 2. Named clients with `forFeature`

`PostsModule` needs two independent clients with different resilience profiles.
`forFeature` creates both and provides them under named DI tokens.

```ts
// posts.module.ts
SuperHttpModule.forFeature([
  {
    name: 'POSTS',
    baseURL: 'https://jsonplaceholder.typicode.com',
    preset: 'high-throughput',   // large pool, 1 fast retry
  },
  {
    name: 'COMMENTS',
    baseURL: 'https://jsonplaceholder.typicode.com',
    preset: 'resilient-api',     // CB + 3 retries + bulkhead
  },
])
```

```ts
// posts.service.ts
constructor(
  @InjectSuperHttp('POSTS')    private readonly postsClient: HttpClient,
  @InjectSuperHttp('COMMENTS') private readonly commentsClient: HttpClient,
) {}
```

---

### 3. Parallel fetch across two clients

`findWithComments` fetches post and comments **simultaneously** from two
independent clients. If comments fail, the circuit breaker trips,
failing fast on subsequent calls without touching the posts client.

```ts
async findWithComments(postId: number) {
  const [postRes, commentsRes] = await Promise.all([
    this.postsClient.get<Post>(`/posts/${postId}`),
    this.commentsClient.get<Comment[]>(`/posts/${postId}/comments`),
  ])
  return { ...postRes.data, comments: commentsRes.data }
}
```

---

### 4. Per-request policy on mutations

`PostsService.create` disables retry for `POST` to avoid creating duplicate
resources on transient failures. The `policy` field is passed via `.request()`.

```ts
async create(dto: Omit<Post, 'id'>) {
  const { data } = await this.postsClient.request<Post>({
    method: 'POST',
    url: '/posts',
    data: dto,
    policy: { retry: false },  // ← non-idempotent: no retry
  })
  return data
}
```

---

### 5. Live metrics endpoint

`HealthController` reads the default client's `MetricsSnapshot` and computes a
simple health status in real time.

```ts
@Get()
check(): HealthStatus {
  const m = this.http.metrics()
  const total  = m.requests
  const errors = m.failed
  const rate   = total > 0 ? (((total - errors) / total) * 100).toFixed(1) : '100.0'

  return {
    status: total > 10 && parseFloat(rate) < 95 ? 'degraded' : 'ok',
    uptime: process.uptime(),
    http: {
      requests:    total,
      errors,
      successRate: `${rate}%`,
      p99:         m.p99Latency > 0 ? `${m.p99Latency.toFixed(1)}ms` : 'N/A',
    },
  }
}
```

---

### 6. Testing approach

| Type | File | Technique |
|---|---|---|
| Unit (service) | `users.service.spec.ts` | Mock `SuperHttpService` with `useValue` |
| Unit (named client) | `posts.service.spec.ts` | Mock via `getSuperHttpClientToken('POSTS')` |
| Unit (controller) | `users.controller.spec.ts` | Mock the service class |
| Integration (e2e) | `test/app.e2e-spec.ts` | Full NestJS app + real JSONPlaceholder |

**Unit test — default client:**
```ts
{ provide: SuperHttpService, useValue: { get: jest.fn(), post: jest.fn() } }
```

**Unit test — named client:**
```ts
import { getSuperHttpClientToken } from 'super-http/nestjs'

{ provide: getSuperHttpClientToken('POSTS'),    useValue: { get: jest.fn() } }
{ provide: getSuperHttpClientToken('COMMENTS'), useValue: { get: jest.fn() } }
```

---

## Common pitfalls

### `import type` breaks `emitDecoratorMetadata`

When you use `import type { MyDto }` in a controller, TypeScript erases the
import at runtime. The compiler then emits `Function` instead of `MyDto` in the
parameter metadata — `ValidationPipe(transform: true)` can't construct the DTO
and passes the **class constructor itself** as the argument, causing Axios to fail
serialising it.

```ts
// ❌ type import erases the constructor at runtime
import type { CreateUserDto } from './dto/create-user.dto'

// ✅ value import preserves metadata for reflection
import { CreateUserDto } from './dto/create-user.dto'
```

### Missing class-validator decorators

`ValidationPipe({ whitelist: true })` strips all properties without a
class-validator decorator. Always annotate DTO properties:

```ts
export class CreateUserDto {
  @IsString() @MinLength(2) name: string
  @IsEmail()               email: string
  @IsString() @IsOptional() username?: string
}
```

### `ConfigModule` not in `forRootAsync` imports

When using `useClass`, the factory is instantiated inside the `SuperHttpModule`
context. Any injected dependency (e.g. `ConfigService`) must be explicitly imported:

```ts
// ✅
SuperHttpModule.forRootAsync({
  imports:  [ConfigModule],   // ← required
  useClass: SuperHttpConfigService,
})
```

### Always enable `emitDecoratorMetadata`

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## CatalogModule — HTTP REST backed by gRPC

`CatalogModule` is the gRPC integration showcase in the example app.
It exposes **standard REST endpoints** while calling a `CatalogService` gRPC
backend internally via `super-http`'s `GrpcClient`.

### Architecture

```
Browser / curl
     │  GET /api/catalog           (HTTP REST)
     │  GET /api/catalog/:id
     │  GET /api/catalog/search?q=
     │  GET /api/catalog/metrics
     ▼
CatalogController  (NestJS @Controller)
     │
     ▼
CatalogService  (NestJS @Injectable)
     │  GrpcClient<CatalogServiceDef>  — injected via @InjectSuperHttp('CATALOG_GRPC')
     │  Resilience: circuit breaker + 2 retries + 5s timeout
     │
     │  HTTP/2 POST /CatalogService/getProduct      (unary)
     │  HTTP/2 POST /CatalogService/listProducts    (server stream)
     │  HTTP/2 POST /CatalogService/searchProducts  (server stream)
     ▼
CatalogService gRPC mock  (HTTP/2, :50053, started in main.ts)
```

### Service definition

```ts
// src/catalog/catalog-service.def.ts
import { defineService, unary, serverStream } from 'super-http/grpc'

export const CATALOG_GRPC_PORT = 50053

export interface Product {
  id: string; name: string; description: string
  price: number; stock: number; category: string; active: boolean
}

export const CatalogServiceDef = defineService('CatalogService', {
  getProduct:     unary<GetProductRequest, Product>(),
  listProducts:   serverStream<ListProductsRequest, Product>(),
  searchProducts: serverStream<SearchProductsRequest, Product>(),
})
```

### Module registration

```ts
// src/catalog/catalog.module.ts
import { SuperHttpModule } from 'super-http/nestjs'
import { CatalogServiceDef, CATALOG_GRPC_PORT } from './catalog-service.def'

@Module({
  imports: [
    SuperHttpModule.forFeature([{
      name:      'CATALOG_GRPC',
      grpc:      true,
      address:   `http://localhost:${CATALOG_GRPC_PORT}`,
      service:   CatalogServiceDef,
      preset:    'resilient-api',
      timeoutMs: 5_000,
      retries:   2,
    }]),
  ],
  controllers: [CatalogController],
  providers:   [CatalogService],
})
export class CatalogModule {}
```

### Service — gRPC calls + error mapping

```ts
// src/catalog/catalog.service.ts
@Injectable()
export class CatalogService {
  constructor(
    @InjectSuperHttp('CATALOG_GRPC')
    private readonly catalog: GrpcClient<typeof CatalogServiceDef>,
  ) {}

  async findOne(id: string): Promise<Product> {
    try {
      return await this.catalog.getProduct({ id })          // unary
    } catch (err) {
      if (err instanceof GrpcError && err.code === 'not_found')
        throw new NotFoundException(`Product "${id}" not found`)  // gRPC → HTTP 404
      throw err
    }
  }

  async findAll(options = {}): Promise<Product[]> {
    const products: Product[] = []
    for await (const p of this.catalog.listProducts(options))  // server stream
      products.push(p)
    return products
  }

  async search(query: string, limit = 10): Promise<Product[]> {
    const results: Product[] = []
    for await (const p of this.catalog.searchProducts({ query, limit }))
      results.push(p)
    return results
  }

  grpcMetrics() { return this.catalog.metrics() }
}
```

### Controller — REST endpoints

| Method | Path | gRPC call |
|---|---|---|
| `GET` | `/api/catalog` | `listProducts` (server stream → JSON array) |
| `GET` | `/api/catalog/search?q=` | `searchProducts` (server stream → JSON array) |
| `GET` | `/api/catalog/metrics` | `metrics()` (local, no RPC) |
| `GET` | `/api/catalog/:id` | `getProduct` (unary) |

```ts
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  findAll(@Query('category') category?: string,
          @Query('inStock')  inStock?: string,
          @Query('limit')    limit?: string) {
    return this.catalogService.findAll({
      category,
      inStock: inStock !== undefined ? inStock === 'true' : undefined,
      limit:   limit   !== undefined ? Number(limit)     : undefined,
    })
  }

  @Get('search')
  search(@Query('q') query = '', @Query('limit') limit?: string) {
    return this.catalogService.search(query, limit ? Number(limit) : 10)
  }

  @Get('metrics')
  grpcMetrics() { return this.catalogService.grpcMetrics() }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.catalogService.findOne(id) }
}
```

### Mock gRPC server (development only)

The example ships an HTTP/2 mock server in
`src/catalog/mock/catalog-grpc-server.ts`. It starts automatically in `main.ts`
before `NestFactory.create()` so you can run `npm run start` without any external
service:

```ts
// src/main.ts (excerpt)
import { startCatalogGrpcServer } from './catalog/mock/catalog-grpc-server'

async function bootstrap() {
  const grpcServer = await startCatalogGrpcServer() // :50053

  const app = await NestFactory.create(AppModule)
  // …
  process.on('SIGTERM', async () => {
    const { GrpcChannelRegistry } = await import('super-http/grpc')
    await GrpcChannelRegistry.closeAll()
    grpcServer.close(() => process.exit(0))
  })
}
```

In production replace `startCatalogGrpcServer()` with your real gRPC backend
and update the `address` in `CatalogModule.forFeature`.

### Try it

```bash
cd example/nestjs-app
npm install && npm run start

# List all products
curl http://localhost:3000/api/catalog

# Filter by category
curl http://localhost:3000/api/catalog?category=electronics

# Full-text search
curl "http://localhost:3000/api/catalog/search?q=keyboard"

# Single product
curl http://localhost:3000/api/catalog/prod-1

# gRPC client metrics (circuit breaker state, p99 latency, …)
curl http://localhost:3000/api/catalog/metrics
```

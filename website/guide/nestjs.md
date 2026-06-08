# NestJS Integration

super-http ships a first-class NestJS module — `SuperHttpModule` — that wraps the full resilience stack as an injectable, DI-aware service.

```ts
import { SuperHttpModule, SuperHttpService, InjectSuperHttp } from 'super-http/nestjs'
```

::: info Sub-path import
The NestJS integration lives at `super-http/nestjs` — a separate entry point that only loads if `@nestjs/common` is installed. Non-NestJS projects are unaffected.
:::

---

## Installation

super-http lists NestJS as an **optional peer dependency** — install it alongside your NestJS app:

```bash
npm install super-http
# @nestjs/common and @nestjs/core should already be installed
```

---

## Quick start

### 1. Import the module

Register `SuperHttpModule` globally in your root module:

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { SuperHttpModule } from 'super-http/nestjs'

@Module({
  imports: [
    SuperHttpModule.forRoot({
      baseURL: 'https://api.example.com',
      preset: 'resilient-api',   // circuit breaker + retry + bulkhead
    }),
  ],
})
export class AppModule {}
```

### 2. Inject and use

```ts
// users.service.ts
import { Injectable } from '@nestjs/common'
import { SuperHttpService } from 'super-http/nestjs'

@Injectable()
export class UsersService {
  constructor(private readonly http: SuperHttpService) {}

  async findAll() {
    const { data } = await this.http.get<User[]>('/users')
    return data
  }

  async create(dto: CreateUserDto) {
    const { data } = await this.http.post<User>('/users', dto)
    return data
  }
}
```

---

## Async configuration (ConfigService)

When your base URL or preset come from environment variables, use `forRootAsync`:

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { SuperHttpModule } from 'super-http/nestjs'

@Module({
  imports: [
    ConfigModule.forRoot(),
    SuperHttpModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        baseURL: config.getOrThrow('API_BASE_URL'),
        preset: config.get('API_PRESET') ?? 'resilient-api',
        headers: {
          Authorization: `Bearer ${config.getOrThrow('API_TOKEN')}`,
        },
        pool: {
          maxSockets: Number(config.get('API_MAX_SOCKETS') ?? 100),
          timeout:    Number(config.get('API_TIMEOUT_MS')  ?? 15_000),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Using `useClass`

For complex configs, extract the factory into a dedicated class:

```ts
// super-http-config.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SuperHttpOptionsFactory, SuperHttpModuleOptions } from 'super-http/nestjs'

@Injectable()
export class SuperHttpConfigService implements SuperHttpOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createSuperHttpOptions(): SuperHttpModuleOptions {
    return {
      baseURL: this.config.getOrThrow('API_BASE_URL'),
      preset: 'resilient-api',
    }
  }
}

// app.module.ts
SuperHttpModule.forRootAsync({
  imports: [ConfigModule],
  useClass: SuperHttpConfigService,
})
```

---

## Multiple clients

Register named clients per feature module using `forFeature`. Each client is fully independent — own pool, own circuit breaker, own retry config.

```ts
// payments.module.ts
import { Module } from '@nestjs/common'
import { SuperHttpModule } from 'super-http/nestjs'
import { PaymentsService } from './payments.service'

@Module({
  imports: [
    SuperHttpModule.forFeature([
      {
        name: 'PAYMENTS',
        baseURL: 'https://payments.internal',
        preset: 'resilient-api',
        headers: { 'X-Service': 'payments' },
      },
    ]),
  ],
  providers: [PaymentsService],
})
export class PaymentsModule {}
```

```ts
// catalog.module.ts
@Module({
  imports: [
    SuperHttpModule.forFeature([
      {
        name: 'CATALOG',
        baseURL: 'https://catalog.internal',
        preset: 'high-throughput',
      },
      {
        name: 'INVENTORY',
        baseURL: 'https://inventory.internal',
        preset: 'low-latency',
      },
    ]),
  ],
})
export class CatalogModule {}
```

Inject named clients using `@InjectSuperHttp('NAME')`:

```ts
// payments.service.ts
import { Injectable } from '@nestjs/common'
import { InjectSuperHttp } from 'super-http/nestjs'
import type { HttpClient } from 'super-http'

@Injectable()
export class PaymentsService {
  constructor(
    @InjectSuperHttp('PAYMENTS') private readonly payments: HttpClient,
    @InjectSuperHttp('CATALOG')  private readonly catalog: HttpClient,
  ) {}

  async charge(dto: ChargeDto) {
    const { data } = await this.payments.post<ChargeResult>('/charges', dto)
    return data
  }
}
```

---

## Applying resilience after init

All presets apply sensible defaults but you can override anything via `SuperHttpService.instance` or after getting the `HttpClient`:

```ts
// on-module-init.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { SuperHttpService } from 'super-http/nestjs'
import { ExponentialJitterRetryStrategy, LoggerPlugin } from 'super-http'

@Injectable()
export class AppBootstrapService implements OnModuleInit {
  constructor(private readonly http: SuperHttpService) {}

  onModuleInit() {
    this.http.instance
      // Override circuit breaker thresholds
      .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
      // Override retry strategy
      .retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
      // Add a logger plugin
      .use(LoggerPlugin({ prefix: '[api]', level: 'debug' }))
      // Add observability hooks
      .on({
        onRetry: ({ attempt, delayMs }) =>
          console.warn(`[API] retry #${attempt} in ${delayMs}ms`),
        onCircuitStateChange: ({ from, to }) =>
          console.error(`[API] circuit ${from} → ${to}`),
      })
  }
}
```

---

## Observability and metrics

### Exposing metrics via a health endpoint

```ts
// health.controller.ts
import { Controller, Get } from '@nestjs/common'
import { SuperHttpService } from 'super-http/nestjs'

@Controller('health')
export class HealthController {
  constructor(private readonly http: SuperHttpService) {}

  @Get('metrics')
  metrics() {
    return this.http.metrics()
    // {
    //   requests: 1420, success: 1389, failed: 31, retries: 12,
    //   circuitBreakerTrips: 2, p50Latency: 34, p95Latency: 210, p99Latency: 540,
    //   uptime: 86400000
    // }
  }
}
```

### Prometheus / OpenTelemetry plugin

```ts
// metrics.plugin.ts
import { MetricsReporterPlugin } from 'super-http'
import { Counter, Histogram, register } from 'prom-client'

const requestsTotal  = new Counter({ name: 'http_requests_total',       labelNames: ['status'] })
const latencySeconds = new Histogram({ name: 'http_request_duration_seconds', labelNames: ['route'] })

export const PrometheusPlugin = MetricsReporterPlugin({
  intervalMs: 15_000,
  onReport: (snapshot) => {
    requestsTotal.inc({ status: 'success' }, snapshot.success)
    requestsTotal.inc({ status: 'failed' },  snapshot.failed)
  },
})

// Then in bootstrap:
http.instance.use(PrometheusPlugin)
```

---

## Per-request policy override

Use `policy` to override resilience settings per request — useful for non-idempotent operations like payments:

```ts
// payments.service.ts
async charge(dto: ChargeDto) {
  // Disable retry for POST /charges — non-idempotent
  const { data } = await this.payments.post('/charges', dto, {
    policy: { retry: false, timeout: 10_000 },
  } as never)
  return data
}

// recommendations.service.ts
async getRecommendations(userId: string) {
  // Fast fallback for non-critical endpoint
  return this.catalog.get(`/users/${userId}/recommendations`, {
    policy: { timeout: 300, fallback: () => [] },
  } as never)
}
```

---

## Complete example

A production-ready service with full resilience, observability and error handling:

```ts
// external-api.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SuperHttpService } from 'super-http/nestjs'
import { ExponentialJitterRetryStrategy, LoggerPlugin } from 'super-http'

@Injectable()
export class ExternalApiService implements OnModuleInit {
  private readonly logger = new Logger(ExternalApiService.name)

  constructor(
    private readonly http: SuperHttpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.http.instance
      .circuitBreak({ failureThreshold: 10, successThreshold: 3, timeoutMs: 30_000 })
      .retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
      .bulkhead({ maxConcurrent: 50, maxQueue: 200 })
      .use(LoggerPlugin({ prefix: '[external-api]' }))
      .on({
        onRetry: ({ attempt, error }) =>
          this.logger.warn(`Retry #${attempt}: ${String(error)}`),
        onCircuitStateChange: ({ from, to, failures }) =>
          this.logger.error(`Circuit ${from} → ${to} (${failures} failures)`),
        onFallback: ({ error }) =>
          this.logger.warn(`Fallback triggered: ${String(error)}`),
      })
  }

  async getUser(id: string) {
    const { data } = await this.http.get<User>(`/users/${id}`)
    return data
  }

  async createOrder(dto: CreateOrderDto) {
    const { data } = await this.http.post<Order>('/orders', dto, {
      policy: { retry: false, timeout: 30_000 },
    } as never)
    return data
  }

  healthCheck() {
    const m = this.http.metrics()
    return {
      status: m.circuitBreakerTrips > 0 ? 'degraded' : 'ok',
      ...m,
    }
  }
}
```

---

## Testing

### Unit tests with jest

```ts
// users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { UsersService } from './users.service'
import { SuperHttpService } from 'super-http/nestjs'

const mockSuperHttpService = {
  get: jest.fn(),
  post: jest.fn(),
}

describe('UsersService', () => {
  let service: UsersService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SuperHttpService, useValue: mockSuperHttpService },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    jest.clearAllMocks()
  })

  it('findAll calls GET /users', async () => {
    mockSuperHttpService.get.mockResolvedValue({ data: [{ id: 1, name: 'Ana' }] })
    const result = await service.findAll()
    expect(result).toHaveLength(1)
    expect(mockSuperHttpService.get).toHaveBeenCalledWith('/users')
  })
})
```

### Integration tests with real module

```ts
// app.e2e-spec.ts
import { Test } from '@nestjs/testing'
import { SuperHttpModule } from 'super-http/nestjs'
import { HttpClientFactory } from 'super-http'

afterEach(() => HttpClientFactory.clear()) // reset singleton cache between tests

it('creates a working client via forRoot', async () => {
  const module = await Test.createTestingModule({
    imports: [
      SuperHttpModule.forRoot({
        baseURL: 'https://jsonplaceholder.typicode.com',
        preset: 'resilient-api',
      }),
    ],
  }).compile()

  const http = module.get(SuperHttpService)
  const { data } = await http.get('/todos/1')
  expect(data).toMatchObject({ id: 1 })
})
```

---

## API reference

### `SuperHttpModule`

| Method | Description |
|---|---|
| `forRoot(options)` | Registers a global default client. Provides `SuperHttpService`. |
| `forRootAsync(asyncOptions)` | Same as `forRoot` but with async factory / ConfigService. |
| `forFeature(clients[])` | Registers named clients for a specific feature module. |

### `SuperHttpService`

Wraps the default `HttpClient`. Available when using `forRoot` / `forRootAsync`.

| Member | Description |
|---|---|
| `get / post / put / patch / delete` | Standard HTTP methods |
| `metrics()` | Returns `MetricsSnapshot` |
| `resetMetrics()` | Clears counters |
| `on(events)` | Register observability hooks |
| `use(plugin)` | Install a plugin |
| `instance` | Access the raw `HttpClient` |

### `@InjectSuperHttp(name?)`

Parameter decorator. Without `name` → injects default client. With `name` → injects named client registered by `forFeature`.

### `getSuperHttpClientToken(name)`

Returns the DI token string for a named client. Useful for manual provider setup.

---

## Example application

Looking for a complete, runnable reference? The repository ships a full NestJS application in [`example/nestjs-app/`](https://github.com/jhonesgoncalves/super-http-ts/tree/main/example/nestjs-app) with architecture diagrams, all patterns above, and 42 tests.

→ [NestJS Example App](/guide/nestjs-example)

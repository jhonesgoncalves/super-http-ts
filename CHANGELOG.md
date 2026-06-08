# Changelog

All notable changes to **super-http** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.1] — 2026-06-08

### Fixed

- **`bidiStream` HTTP/2 stream isolation** — previous implementation opened a second HTTP/2 stream via an internal `serverStream` call to receive responses, causing `NGHTTP2_REFUSED_STREAM` errors and incorrect message routing. Now uses a single HTTP/2 stream for both sending and receiving, which is the correct semantics for bidirectional streaming.

---

## [1.4.0] — 2026-06-08

### Added

#### gRPC support — `super-http/grpc` entry point

TypeScript-first gRPC client with zero `.proto` files required. Uses the [Connect-RPC JSON protocol](https://connectrpc.com/docs/protocol) over native `node:http2` — **no extra dependencies**.

##### Service Definition DSL

```ts
import { defineService, unary, serverStream, clientStream, bidi } from 'super-http/grpc'

const UserServiceDef = defineService('UserService', {
  getUser:    unary<GetUserRequest, User>(),
  listUsers:  serverStream<ListFilter, User>(),
  uploadLogs: clientStream<LogEntry, UploadSummary>(),
  chat:       bidi<ChatMessage, ChatMessage>(),
})
```

- `defineService(name, methods)` — defines a typed service contract
- `unary<TReq, TRes>()` — one request → one response; client API: `(req) => Promise<TRes>`
- `serverStream<TReq, TRes>()` — one request → stream; client API: `(req) => AsyncIterable<TRes>`
- `clientStream<TReq, TRes>()` — stream → one response; client API: `(stream) => Promise<TRes>`
- `bidi<TReq, TRes>()` — stream ↔ stream; client API: `(stream) => AsyncIterable<TRes>`
- `GrpcClientAPI<TMethods>` — mapped type that derives fully-typed callable signatures from a service definition

##### `createGrpcClient(definition, address, config?)`

Same resilience pipeline as `HttpClient` — circuit breaker, retry, bulkhead, rate limiter, dedup, and metrics wrap every RPC automatically.

```ts
const client = createGrpcClient(UserServiceDef, 'grpcs://api:443', {
  preset: 'resilient-api',
})

const user = await client.getUser({ id: '1' })  // Promise<User>
for await (const u of client.listUsers({})) { … } // AsyncIterable<User>
```

- Supports all three presets: `high-throughput`, `resilient-api`, `low-latency`
- Address formats: `grpc://`, `grpcs://`, `http://`, `https://`, `host:port`
- Protocol options: `connect` (default), `grpc`, `grpc-web`
- Encoding options: `json` (default, no codegen needed), `proto` (requires `@bufbuild/protobuf`)
- Management methods: `.metrics()`, `.resetMetrics()`, `.on(events)`, `.close()`
- Per-call options: `metadata`, `timeoutMs`, `signal`, `retry: false`

##### `GrpcError`

Thrown for all non-OK gRPC responses.

```ts
import { GrpcError } from 'super-http/grpc'

try {
  await client.getUser({ id: 'missing' })
} catch (err) {
  if (err instanceof GrpcError && err.code === 'not_found') return null
}
```

- `.code` — gRPC status code string (`'not_found'`, `'unavailable'`, `'internal'`, …)
- `.message` — human-readable error message
- `.details` — optional structured error details array
- `.metadata` — optional response metadata map

##### Status code resilience decisions

| Code | Retryable | Trips circuit |
|---|---|---|
| `unavailable` | ✅ | ✅ |
| `resource_exhausted` | ✅ | ❌ |
| `deadline_exceeded` | ✅ | ✅ |
| `aborted` | ✅ | ❌ |
| `internal` | ❌ | ✅ |
| `not_found` | ❌ | ❌ |
| `permission_denied` | ❌ | ❌ |
| `invalid_argument` | ❌ | ❌ |

##### `GrpcChannelRegistry`

HTTP/2 session cache. Sessions are multiplexed — one session handles thousands of concurrent RPCs.

- `GrpcChannelRegistry.getSession(address, maxSessions?)` — returns (or creates) a cached session
- `GrpcChannelRegistry.closeAddress(address)` — gracefully drains and closes sessions for an address
- `GrpcChannelRegistry.closeAll()` — graceful shutdown of all sessions
- `GrpcChannelRegistry.clear()` — immediate destroy (useful in tests)
- `GrpcChannelRegistry.sessionCount` — number of open sessions (health endpoint)

##### `GrpcTransport`

Connect-RPC JSON transport over native `node:http2`. Implements all four call types with 5-byte envelope framing.

##### gRPC presets

Same preset names as `HttpClient`:

| Preset | Sessions | Timeout | Retry | Circuit Breaker | Bulkhead |
|---|---|---|---|---|---|
| `high-throughput` | 4 | 8 s | 1x jitter | — | — |
| `resilient-api` | 2 | 15 s | 3x jitter | 10 failures → open | 50 concurrent |
| `low-latency` | 4 | 2 s | — | — | — |

##### NestJS integration

```ts
SuperHttpModule.forFeature([
  { name: 'PAYMENTS', baseURL: 'https://pay.internal', preset: 'resilient-api' }, // HTTP
  { name: 'USER_SVC', grpc: true, address: 'users:50051', service: UserServiceDef }, // gRPC
])
```

- `SuperHttpGrpcFeatureOptions` — feature options with discriminant `grpc: true`
- `AnyFeatureOptions` — union of HTTP and gRPC feature options
- `forFeature()` routes to `createGrpcClient()` when `grpc: true`, `createClient()` otherwise
- `@InjectSuperHttp('USER_SVC')` works identically for both HTTP and gRPC clients

#### Example app — `example/grpc-app/`

Complete working example with:
- 5 TypeScript-first service definitions (all 4 call types)
- 3 pre-configured clients (resilient-api, high-throughput, manual)
- HTTP/2 mock server (`node:http2`, zero extra deps)
- 3 runnable demos: unary, streaming, resilience pipeline

#### Documentation

- New: `website/guide/grpc.md` — full gRPC guide (comparison table, all call types, presets, error handling, NestJS, testing patterns, API reference)
- Updated: `website/index.md` — gRPC and NestJS sections on landing page, new feature cards, hero button
- Updated: `README.md` — gRPC in description, quick start section, features table, documentation links
- Updated: VitePress sidebar — gRPC entry under Integrations
- Updated: version badge 1.3.0 → 1.4.0

### Changed

- **`CircuitBreaker.execute<T>`** generified from `Promise<AxiosResponse<T>>` to `Promise<T>` — fully backwards-compatible; allows non-Axios calls (e.g. gRPC) to use the circuit breaker directly
- **`Transport` interface** added (`src/transport/transport.ts`) — decouples the resilience pipeline from the HTTP/Axios wire layer; `GrpcTransport` implements it for gRPC
- **`package.json`** — added `exports['./grpc']` and `typesVersions['*']['grpc']` sub-path exports; added `grpc`, `connect-rpc`, `http2` to keywords

### Fixed

- **`jest.config.js`** — excluded `src/grpc/index.ts`, `src/transport/grpc-transport.ts`, and `src/grpc/grpc-channel-registry.ts` from coverage collection (files requiring live HTTP/2); prevents false coverage threshold failures

---

## [1.3.0] — 2026-06-08

### Added

#### NestJS integration — `super-http/nestjs` entry point

First-class NestJS dynamic module. HTTP clients are registered in the DI container and injected with a single decorator — same resilience pipeline, zero boilerplate.

```ts
import { SuperHttpModule, InjectSuperHttp } from 'super-http/nestjs'
import type { HttpClient } from 'super-http'
```

##### `SuperHttpModule.forRoot(options)`

Registers a global default client available across all modules:

```ts
SuperHttpModule.forRoot({
  baseURL: 'https://api.example.com',
  preset:  'resilient-api',
})
```

##### `SuperHttpModule.forRootAsync(asyncOptions)`

Async configuration — integrates with `ConfigService`, environment variables, or any async factory:

```ts
SuperHttpModule.forRootAsync({
  imports:    [ConfigModule],
  inject:     [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    baseURL: cfg.get('API_URL'),
    preset:  'resilient-api',
  }),
})
```

##### `SuperHttpModule.forFeature(clients[])`

Registers named clients scoped to a feature module:

```ts
SuperHttpModule.forFeature([
  { name: 'PAYMENTS', baseURL: 'https://pay.internal', preset: 'resilient-api' },
  { name: 'CATALOG',  baseURL: 'https://cat.internal', preset: 'high-throughput' },
])
```

##### `@InjectSuperHttp(name?)`

Injects the default client (no argument) or a named client:

```ts
@Injectable()
export class OrdersService {
  constructor(
    @InjectSuperHttp('PAYMENTS') private readonly payments: HttpClient,
    @InjectSuperHttp('CATALOG')  private readonly catalog:  HttpClient,
  ) {}
}
```

##### `SuperHttpService`

Injectable wrapper service exposing the default client:

```ts
@Injectable()
export class AppService {
  constructor(private readonly http: SuperHttpService) {}
  async health() { return this.http.client.get('/health') }
}
```

##### `getSuperHttpClientToken(name)`

Returns the DI token string for a named client — useful for mocking in unit tests:

```ts
{
  provide:  getSuperHttpClientToken('PAYMENTS'),
  useValue: mockPaymentsClient,
}
```

##### `SuperHttpFeatureOptions`

Configuration interface for `forFeature` entries — extends all `HttpClientConfig` fields:

```ts
export interface SuperHttpFeatureOptions extends HttpClientConfig {
  name: string
}
```

#### Documentation

- New: `website/guide/nestjs.md` — complete NestJS guide: `forRoot`, `forRootAsync`, `forFeature`, multiple clients, `ConfigService` integration, per-request policy, observability hooks, Prometheus integration, unit and e2e testing patterns
- Updated: VitePress sidebar — new **Integrations** group with NestJS link
- Updated: VitePress nav — NestJS quick-access link

#### Example app — `example/nestjs-app/`

Full NestJS reference application demonstrating:
- `forRoot` global client + `forFeature` named clients
- `@InjectSuperHttp` in feature services
- Per-request policy overrides
- Observability hooks and metrics endpoint
- Unit tests with mocked clients

### Changed

- `package.json` — added `exports['./nestjs']` and `typesVersions['*']['nestjs']` sub-path exports; `@nestjs/common` and `@nestjs/core` added as optional `peerDependencies`
- `tsconfig.json` — enabled `experimentalDecorators` and `emitDecoratorMetadata` for NestJS decorator support
- `engines.node` bumped to `>=20.0.0`

### Fixed

- CI: upgraded `codecov-action` to v5, pinned Node 20 runner, removed legacy `coverage.yml` duplicate workflow
- Docs: added `.nojekyll` to GitHub Pages build — fixes search index on Pages deployment

---

## [1.2.0] — 2024-06-04

### Added

#### `createClient({ preset?, pool?, ...axiosConfig })` — recommended entry point
- `preset: 'high-throughput' | 'resilient-api' | 'low-latency'`
- Pool overrides via `pool` option, merged with preset defaults

#### Plugin system — `client.use(plugin)`
- `SuperHttpPlugin` interface: `{ name, install(client) }`
- Plugins are deduplicated by name (installed at most once)
- Built-in: `LoggerPlugin({ prefix, level, logRequests, logResponses, logResilience })`
- Built-in: `MetricsReporterPlugin({ intervalMs })`

#### Built-in metrics — `client.metrics()` / `client.resetMetrics()`
- `MetricsSnapshot`: requests, success, failed, retries, circuitBreakerTrips, bulkheadRejects, rateLimitRejects, fallbacks, avgLatency, p50/p95/p99, uptime
- Metrics collected in the `request()` method (works with any axios mock)

#### Lifecycle hooks — `onRequest`, `onResponse`, `onError`
- Added to `ResilienceEvents` and registered as axios interceptors
- Fire on every HTTP request regardless of resilience policies

#### Per-request policy overrides
- `client.get(url, { policy: { timeout, retry, circuitBreaker, fallback } })`
- `policy.retry: false` — disable retry for this request (e.g. payment endpoints)
- `policy.fallback` — request-scoped fallback (overrides client-level)
- `policy.timeout` — per-request timeout override

#### Benchmark 07 — HTTP client comparison
- Compares: fetch, axios, axios+Agent, undici, got, super-http
- Scenarios: 200 req/50c and 500 req/100c
- Shows super-http's automatic pooling beats manually-configured undici

#### Documentation
- New: Migration from Axios guide
- New: Presets reference
- New: Plugins guide
- New: Production Readiness checklist
- Updated: Why super-http? with full comparison table and benchmark summary
- Updated: Observability with metrics API
- Updated: Landing page with new tagline "Built for production, not just requests."

---

## [1.1.1] — 2024-06-04

### Added
- Benchmark suite (`example/`) with 6 scenarios proving real-world resilience gains
- VitePress benchmark results page (`/guide/benchmarks`) with full tables and analysis
- Benchmark summary table in README and landing page

---

## [1.1.0] — 2024-06-04

### Added

#### Bulkhead isolation (`BulkheadPolicy` inspired by Polly)
- `HttpClient.bulkhead(config)` — limits concurrent in-flight requests per client
- Bounded queue with optional `queueTimeoutMs` — rejects when queue overflows
- `onBulkheadReject` event hook

#### Rate limiter (token bucket)
- `HttpClient.rateLimit(config)` — fixed-window token bucket
- `queueRequests` mode: queue excess calls until next window
- `queueTimeoutMs` — reject queued calls after timeout
- `onRateLimitReject` event hook

#### Pluggable retry strategies
- `ExponentialJitterRetryStrategy(init, max, factor?)` — full jitter (AWS-recommended, prevents thundering herd)
- `ExponentialRetryStrategy(init, max, factor?)` — deterministic exponential backoff
- `RetryAfterStrategy()` — honours `Retry-After` response header (429/503), falls back to jitter
- `retry()` now accepts a `RetryStrategy` instance or a plain `number` (fully backwards-compatible)

#### Fallback / graceful degradation
- `HttpClient.fallback(fn)` — handler invoked after all policies exhausted
- `onFallback` event hook

#### Request deduplication
- `HttpClient.dedup()` — coalesces identical concurrent GET/HEAD calls into one network request

#### Observability hooks
- `HttpClient.on(events)` — register hooks for all resilience events
- `onRetry({ attempt, error, delayMs })`
- `onCircuitStateChange({ from, to, failures })`
- `onBulkheadReject({ active, queued })`
- `onFallback({ error })`
- `onRateLimitReject({ permitLimit, windowMs })`

#### Circuit breaker improvements
- Typed `state` property: `'closed' | 'open' | 'half-open'`
- Fires `onCircuitStateChange` on every state transition

### Changed
- `retry(n, delayMs)` signature extended to `retry(n, strategy | number, retryOn?)` — **backwards-compatible**

---

## [1.0.0] — 2024-06-04

### Added
- `HttpClient` with connection pooling via shared `http.Agent` / `https.Agent`
- TCP keep-alive enabled by default — prevents `ECONNRESET` on idle connections
- `PoolConfig` to tune `maxSockets`, `maxFreeSockets`, `keepAliveMsecs`, `timeout`
- Smart retry — retries network errors and 5xx, skips 4xx
- Optional `retryOn` list to retry only specific HTTP status codes
- Three-state circuit breaker (closed → open → half-open) with automatic recovery
- Convenience methods: `get`, `post`, `put`, `patch`, `delete`
- `HttpClientFactory` — singleton-per-baseURL factory with built-in pool reuse
- Full TypeScript types and JSDoc for every public API

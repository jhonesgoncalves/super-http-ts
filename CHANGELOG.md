# Changelog

All notable changes to **super-http** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — Unreleased

Hardening pass against the stability patterns in Michael Nygard's *Release It!*,
plus four data-integrity bugs found along the way. See the
[1.x → 2.0 migration guide](website/guide/migration-2.md).

### Security

- **`axios` bumped from `1.3.4` to `^1.19.0`.** The lockfile pinned `1.3.4` (Feb 2023), which `npm ci` installed in CI and in any consumer inheriting the lockfile. That version sits inside the `>=1.0.0 <1.18.0` range flagged **high** by `npm audit`, covering SSRF via absolute URL ([GHSA-jr5f-v2jv-69x6](https://github.com/advisories/GHSA-jr5f-v2jv-69x6)), CSRF ([GHSA-wf5p-g6vw-rhxx](https://github.com/advisories/GHSA-wf5p-g6vw-rhxx)), `Proxy-Authorization` leakage across redirects, prototype-pollution config gadgets and several DoS vectors. `npm audit --omit=dev` is now clean.

### ⚠️ BREAKING CHANGES

Every one of these changes a default that was unsafe. The old behaviour is
recoverable in each case — the migration guide shows how.

- **Retry now respects method idempotency.** Errors that prove the request never
  executed (`ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`) are still retried for any
  method. Ambiguous errors — `ECONNRESET`, `ETIMEDOUT`, `ECONNABORTED`, `EPIPE`
  and any 5xx, where the request may already have been applied — are now retried
  only for idempotent methods (`GET`/`HEAD`/`OPTIONS`/`PUT`/`DELETE`/`TRACE`).
  Axios surfaces its own timeout as `ETIMEDOUT`/`ECONNABORTED`, so previously
  **every timed-out `POST` was re-sent**, and a `POST /payments` with `retry(3)`
  could charge four times. Opt back in per client with
  `retry(n, delay, { retryNonIdempotent: true })` or per request with
  `policy: { retry: { attempts: n, retryNonIdempotent: true } }`.
- **`retryOn` is additive instead of a replacement.** `retry(3, 500, [503])` used
  to *disable* network-error retries entirely; it now adds 503 on top of them.
- **A 4xx no longer trips the circuit breaker.** Axios rejects 4xx responses and
  the breaker counted every rejection, so a burst of 404s or 401s — correct
  answers from a healthy upstream — opened the circuit and took down working
  traffic. `429` is also excluded: it is backpressure, which the rate limiter and
  `Retry-After` handle. Override with `circuitBreak({ …, shouldTrip })`.
- **gRPC deduplication is opt-in.** It was on for every unary call with no way to
  disable it, silently collapsing two concurrent identical mutations into one RPC.
  Set `dedup: true` in `GrpcClientConfig` to restore it.
- **HTTP deduplication only coalesces `GET` and `HEAD`.** Widen deliberately with
  `dedup({ methods: [...] })`.
- **Queues no longer wait forever.** `queueTimeoutMs` now defaults to 10 s on both
  `Bulkhead` and `RateLimiter`; pass `Infinity` to opt back into an unbounded
  wait. The rate limiter also gained `maxQueue` (default 1000).
- **Response and request bodies are capped at 32 MiB** (`maxContentLength` /
  `maxBodyLength`), where axios defaults to unlimited. Raise via `PoolConfig`.
- **Invalid configuration now throws at wiring time** instead of misbehaving at
  runtime. See *Fail Fast* below.
- **An unknown gRPC preset name throws** instead of being silently ignored, which
  used to produce a client with no resilience at all.
- **`on()` accumulates handlers** rather than overwriting per key. Two plugins
  observing the same hook both run now; previously only the last registered did.

### Fixed

- **Deduplication returned one caller another caller's response.** The HTTP dedup
  key was `method:url:params` — the request **body was not part of it** — so two
  concurrent `POST`s with different payloads collapsed into one call and the
  second caller received the first one's result. The body is now part of the key,
  and a body that cannot be compared byte-for-byte (a stream, a `FormData`, a
  circular object) is never deduplicated rather than guessed at. The documentation
  had claimed the body was already keyed; it was not.
- **`shouldTripCircuit` was dead code.** The gRPC error mapper's per-code table
  correctly marked `not_found`, `invalid_argument`, `unauthenticated`,
  `permission_denied`, `resource_exhausted` and `aborted` as non-tripping, and the
  function implementing it was exported and tested — but never called. The gRPC
  breaker counted every error, so a burst of 404s opened the circuit. Now wired in.
- **No call had an upper bound the caller could state.** `timeout` bounded a single
  attempt, and each retry got a fresh one, so with the shipped `resilient-api`
  preset one `await client.get()` could run ~76 s (5 s bulkhead queue + 4 × 15 s
  attempts + ~11 s of backoff). New `client.deadline(ms)` and
  `policy: { deadlineMs }` bound the **total**: queue waits, every attempt and
  every backoff. Each stage clamps itself to the remaining budget, and retry fails
  immediately rather than sleeping past the deadline.
- **Nothing was cancellable.** `policy: { signal }` now cancels the whole call.
  The retry backoff, the bulkhead wait and the rate-limiter wait are all abortable;
  previously the caller could give up while the library kept the work alive to its
  end.
- **Retry escaped the rate limiter and starved the bulkhead.** Retry was the
  innermost decorator, so a request held its bulkhead slot through every backoff
  sleep — effective concurrency collapsed with no socket in use — and only the
  first attempt of a call ever took a token, letting `permitLimit: 100` emit 400
  requests. The composition is now `retry(bulkhead(rateLimit(circuitBreaker)))`, so
  capacity is released during backoff and re-acquired per attempt. Bulkhead and
  rate-limiter rejections are explicitly non-retryable.
- **`policy.retry` discarded the client's retry strategy**, always building a fixed
  100 ms delay — turning any per-request override into a thundering herd even when
  the client was configured with exponential jitter. It now inherits the client
  strategy unless `delayMs` is given explicitly.
- **`RetryAfterStrategy` ignored its own `maxDelayMs`** on the header path, so
  `Retry-After: 3600` produced a one-hour, non-abortable sleep. Now clamped.
- **The gRPC envelope length was trusted without validation.** A peer declaring
  `0xFFFFFFFF` made the parser wait for 4 GiB that never arrives while the pending
  buffer grew without bound. Lengths are now checked against a 16 MiB ceiling.
- **`PoolConfig.timeout` never reached the agent.** It was read out of the config
  and used only as the axios response timeout, so nothing bounded a socket that
  simply went quiet. Agents now get an inactivity timeout, configurable separately
  via `socketTimeoutMs`.
- **gRPC abort listeners were never removed**, so a long-lived `AbortSignal` reused
  across calls accumulated one listener per call.
- **`HttpClient` had no way to release its resources.** New `close()` destroys both
  agents and clears plugin timers. `HttpClientFactory.clear()` now closes each
  client before dropping it — the call advertised for test isolation was leaking a
  connection pool per invocation.
- **Deduplication had no TTL**, so a request that never settled pinned its key
  forever and every later identical call joined the same doomed promise.
- **`MetricsReporterPlugin` never cleared its interval.** Plugins may now define
  `uninstall()`, called by `close()`.
- **The gRPC `resilient-api` preset shipped a 200-deep bulkhead queue with no
  timeout**, so 200 RPCs could block indefinitely by factory configuration.

- **Circuit breaker counted cumulative, not consecutive, failures — and tripped on healthy services.** A success never cleared the failure counter (`handleSuccess` called `transitionTo('closed')`, which returns early when already closed), and the counter was only reset when a full `timeoutMs` elapsed with no failure at all. With the `resilient-api` preset (`failureThreshold: 10`, `timeoutMs: 10_000`) a service at 99.5% success and ~58 rps tripped its breaker roughly every 30 seconds. A success now resets the streak, so `failureThreshold` means what the docs always said it meant.
- **Circuit breaker allowed unlimited concurrent probes in half-open.** `execute()` only guarded against `open`, so every request arriving during recovery reached the upstream — a stampede on the service that had just come back. Half-open now admits exactly one probe at a time; the rest are refused with `Circuit breaker is open`.
- **`successThreshold` decayed to `1` after the first few successes.** `successes` was never reset when the circuit opened, and grew monotonically while closed, so the first successful probe after a trip closed the circuit regardless of the configured threshold. Counters are now reset on every transition.
- **A per-request `policy.circuitBreaker` permanently rewrote the client-wide breaker.** `withCircuitBreaker` called `setConfig()` on the single shared breaker on *every* request, so one override changed the thresholds for all subsequent requests, and requests with different policies pooled their failure counts and open/closed state. Overrides now get their own breaker instance keyed by config (capped at 64 distinct configs), and the client-level breaker is configured once by `circuitBreak()`.
- **Circuit-breaker state-change events reported `failures: 0` on close.** The counter was zeroed before the event was constructed; events now carry the streak that caused the transition.
- **Unbounded memory growth in `MetricsCollector`.** Every successful request pushed its latency onto an array that was never trimmed — roughly 40 MB/day at 58 rps. Worse, `snapshot()` copied and sorted that whole array, and `MetricsReporterPlugin` calls it every 60 s, so a multi-million-element sort blocked the event loop periodically long before memory became fatal. Latencies now live in a fixed 2048-entry ring buffer (16 KB per client, `sort()` bounded to 2048).
- **Rate limiter permanently lost a token on every queue timeout.** A timed-out waiter was rejected but left in `waitQueue`; `drainQueue()` then decremented `tokens` and resolved the already-settled promise, so effective throughput decayed below `permitLimit` cumulatively. The entry is now removed before rejecting, matching `Bulkhead`. Also clamps a negative refill delay.
- **`resetMetrics()` did not reset `uptime`**, despite the documented contract that all counters accumulate from the last reset.

### Added

- **Fail Fast configuration guards.** `maxConcurrent: 0` used to deadlock every
  request with no error; `permitLimit: 0` rejected or hung forever; `windowMs: 0`
  turned the rate limiter into a silent no-op; `failureThreshold: 0` left the
  circuit permanently open; `maxSockets: 0` meant *unlimited* to Node, the opposite
  of what it reads like. All of these now throw at the call that sets them, naming
  the value received and the value expected.
- **`client.state()`** — the current state of every configured component: circuit
  state (including per-policy breakers), bulkhead active/queued, rate-limiter
  tokens and queue depth, dedup in-flight count. `circuitBreakerTrips` could only
  say the circuit opened at some point, never whether it is open right now.
- **`client.correlate()`** — a per-request id, sent in a configurable header
  (default `x-request-id`, never overwriting a caller-supplied one) and attached to
  every resilience event. Retry and fallback events were previously anonymous.
- **`RateLimiter.queuedCount`** and **`PoolConfig.socketTimeoutMs`**.
- **An integration suite that uses real sockets** (`npm run test:integration`).
  The unit suite mocks axios wholesale, so it never exercised `http.Agent`,
  keep-alive, real timeouts, resets or partial responses — which is exactly where
  these bugs were hiding. 59 tests against a fault-injection server, now part of CI.

### Changed

- **Connection pool defaults raised: `maxSockets` 50 → 200, `maxFreeSockets` 10 → 50.** Steady-state demand is about `rps * latencySeconds` (~12 sockets at 58 rps / 200 ms), so the old default was adequate on average but had no headroom for latency degradation or bursts. Preset pools (100–500) are unchanged.
- `MetricsSnapshot.p50Latency` / `p95Latency` / `p99Latency` are now computed over a rolling window of the most recent successful requests rather than the full process history, so they track current behaviour. `avgLatency` remains exact across all successes.
- `RateLimitConfig` doc corrected: the limiter is a fixed-window token bucket, not sliding-window.
- `MetricsSnapshot.requests` doc corrected: retried attempts are counted in `retries`, not `requests`.

---

## [1.4.7] — 2026-06-09

### Fixed

- **TypeScript project structure — editor vs build tsconfigs** — VSCode uses `tsconfig.json` as the root project reference. Because `__tests__` was in the `exclude` list, test files had no project context and Jest globals (`describe`, `it`, `expect`, `jest`) were unknown. Fixed by splitting into two configs:
  - `tsconfig.json` — editor config: includes all `src/` (tests included), `noEmit: true`, `types: ["node","jest"]`. Used by VSCode and `ts-jest`.
  - `tsconfig.build.json` — build config: extends the above, overrides `noEmit: false`, excludes `__tests__/`. Used by `tsc` (`npm run build`).

---

## [1.4.6] — 2026-06-09

### Fixed

- **`tsconfig.test.json`** — added a dedicated tsconfig for test files that extends the main config, includes `src/__tests__/`, and sets `"noEmit": true`. Pointed `ts-jest` at it so the Jest globals (`describe`, `it`, `expect`) are properly recognised by both the compiler and the VSCode language service. The main `tsconfig.json` continues to exclude test files so they are never emitted to `lib/`.

---

## [1.4.5] — 2026-06-09

### Fixed

- **`tsconfig.json` — Node.js type definitions** — added `"types": ["node", "jest"]` to resolve `Cannot find name 'https'` and related Node.js built-in errors in the IDE. Specifying `types` explicitly prevents TypeScript from auto-loading unrelated `@types/*` packages while keeping Node.js and Jest globals available.

---

## [1.4.4] — 2026-06-09

### Fixed

- **`tsconfig.json` — lib target** — explicitly set `"lib": ["ES2022", "DOM"]` so the TypeScript language service recognises `Array.prototype.includes` (ES2016+) and `AbortSignal.addEventListener` (DOM). Previously the implicit `lib: ES2015` (derived from `target: es6`) caused a false-positive type error in the IDE even though the project compiled and all tests passed.

---

## [1.4.3] — 2026-06-09

### Changed

- **README badges** — replaced `npm/dw` (weekly downloads) with `npm/dt` (total downloads) to avoid the badge showing `0/week` when all downloads fall within the current incomplete calendar week.

---

## [1.4.2] — 2026-06-08

### Fixed

- **`GrpcClient` Proxy — framework inspection properties** — NestJS probes every
  provider at bootstrap for lifecycle hooks (`onModuleInit`, `onModuleDestroy`,
  `onApplicationBootstrap`, `onApplicationShutdown`, `beforeApplicationShutdown`),
  Promise-thenable detection (`then`, `catch`, `finally`), and Node.js serialisation
  helpers (`toJSON`, `toObject`, `inspect`). The `Proxy` get-trap now returns
  `undefined` for all of these — and for every `Symbol` key — instead of throwing
  `[GrpcClient] Method '…' is not defined`. `GrpcClient` instances can now be
  injected with `@InjectSuperHttp` in any NestJS context without additional setup.

### Added

- **`CatalogModule` example in `example/nestjs-app/`** — end-to-end showcase of
  the HTTP → gRPC bridge pattern:
  - `catalog-service.def.ts` — TypeScript-first service definition (no `.proto`)
  - `catalog.module.ts` — `forFeature` with `grpc: true`, `resilient-api` preset
  - `catalog.service.ts` — gRPC unary + server-stream calls with gRPC→HTTP error mapping
  - `catalog.controller.ts` — four REST endpoints backed by gRPC internally
  - `mock/catalog-grpc-server.ts` — HTTP/2 mock on `:50053`, started in `main.ts`

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

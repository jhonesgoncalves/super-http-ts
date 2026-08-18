---
layout: home

hero:
  name: "super-http"
  text: "Built for production, not just requests."
  tagline: Production-grade HTTP + gRPC client for Node.js and TypeScript. Circuit breaker, bulkhead, rate limiter, jitter retry, total deadlines, fallback, metrics and plugins — all in one fluent API.
  image:
    src: /logo.svg
    alt: super-http
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why super-http?
      link: /guide/why
    - theme: alt
      text: gRPC Guide
      link: /guide/grpc
    - theme: alt
      text: View on GitHub
      link: https://github.com/jhonesgoncalves/super-http-ts

features:
  - icon: 🔌
    title: Connection Pooling
    details: Shared http.Agent per base URL with TCP keep-alive. Zero handshake overhead. Prevents ECONNRESET from idle sockets. Auto-configured — no setup required.

  - icon: 🔄
    title: Idempotency-aware Retry
    details: Four pluggable strategies — fixed, exponential, full-jitter (AWS-recommended), and Retry-After-aware. Never retries 4xx or open circuits, and never re-sends a POST on an ambiguous error unless you ask it to.

  - icon: ⚡
    title: Circuit Breaker
    details: Three-state machine that fails fast when upstream is down. 84% faster than waiting for timeouts. Counts consecutive faults only — a burst of 404s will not trip it — and admits a single probe while recovering.

  - icon: 🧱
    title: Bulkhead
    details: Semaphore isolation prevents one slow service from starving others. Bounded queue with configurable timeout. Stops resource exhaustion cascades.

  - icon: 🚦
    title: Rate Limiter
    details: Fixed-window limiter with optional bounded queuing. Retry attempts take tokens too, so the limit bounds what actually leaves your process. Retry-After support means you never accidentally DDoS an API that told you to back off.

  - icon: 🛡️
    title: Fallback
    details: Last line of defence — serve cached data, a default, or call a secondary source when all policies are exhausted. Never propagate avoidable errors.

  - icon: ⏱️
    title: Total Deadlines
    details: client.deadline(ms) bounds the whole call — queue waits, every attempt and every backoff — not just one attempt. Full AbortSignal support cancels work the caller no longer wants.

  - icon: 👁️
    title: Observability
    details: Built-in metrics (req/success/failed/retries/p95/p99) via client.metrics(), live component state via client.state(), and correlation ids on every resilience event. Plugin system for Datadog, OTel, etc.

  - icon: 🎛️
    title: Presets & Policy Engine
    details: One-line setup with high-throughput, resilient-api, or low-latency presets. Per-request policy overrides for fine-grained control on individual endpoints.

  - icon: 📡
    title: gRPC — TypeScript-first
    details: First-class gRPC via super-http/grpc. No .proto files, no code generation. Define services in pure TypeScript — the same circuit breaker, retry, bulkhead and metrics wrap every RPC automatically.

  - icon: 🏗️
    title: NestJS Integration
    details: Register HTTP and gRPC clients in SuperHttpModule.forFeature(). Inject with @InjectSuperHttp() in any provider. All resilience features available inside NestJS DI out of the box.
---

<div class="home-content">

## Proven by benchmarks

Measured against a local Express server, Node.js 20 · [full results →](/guide/benchmarks)

| Scenario | Plain axios | super-http | Gain |
|---|---|---|---|
| Connection pool (200 req, 50c) | 2 222 req/s | **4 545 req/s** | **+105% throughput** |
| 50% flaky service (retry) | 51% success | **96% success** | **+45 pp** |
| Circuit breaker during outage | avg 84 ms/req | avg **14 ms/req** | **−83% latency** |
| Bulkhead isolation | p99 = 31 ms | p99 = **25 ms** | **−19% tail latency** |
| Rate limiter (429 avoidance) | 60% 429 errors | **0% 429 errors** | **zero errors** |
| vs. undici (no pool) | — | **+105%** | auto-pooling beats raw |

---

## The full resilience stack — one fluent API

```typescript
import { createClient, ExponentialJitterRetryStrategy, LoggerPlugin } from 'super-http'

const api = createClient({
  baseURL: 'https://api.example.com',
  preset: 'resilient-api',   // sensible defaults in one line
})

// Add-ons — all optional, all composable
api
  .use(LoggerPlugin({ prefix: '[checkout]' }))
  .on({
    onCircuitStateChange: ({ to, failures }) =>
      to === 'open' && alerts.send(`Circuit opened after ${failures} failures`),
  })

// Per-request policy for non-critical endpoints
const recs = await api.get('/recommendations', {
  policy: { timeout: 500, retry: false, fallback: () => [] },
})

// Built-in metrics — no extra setup
const { p99Latency, circuitBreakerTrips, retries } = api.metrics()
```

## Install

```bash
npm install super-http
```

::: info Requirements
Node.js ≥ 20 · TypeScript ≥ 5
:::

---

## gRPC — TypeScript-first, zero `.proto` files

`super-http/grpc` brings the same resilience pipeline to gRPC. Define your service contract in TypeScript and get a fully-typed client with circuit breaker, retry, bulkhead, and metrics — with zero extra dependencies.

```typescript
import { defineService, unary, serverStream, createGrpcClient, GrpcError } from 'super-http/grpc'

// ① Define service in pure TypeScript — no .proto, no codegen
const UserService = defineService('UserService', {
  getUser:   unary<{ id: string }, User>(),
  listUsers: serverStream<{ active?: boolean }, User>(),
})

// ② Create client with full resilience pipeline
const users = createGrpcClient(UserService, 'grpcs://user-service:443', {
  preset: 'resilient-api',   // circuit breaker + retry x3 + bulkhead
})

// ③ Unary call — typed response, retry + circuit breaker active
const user = await users.getUser({ id: '42' })

// ④ Server streaming — native AsyncIterable, HTTP/2 backpressure
for await (const u of users.listUsers({ active: true })) {
  await processUser(u)
}

// ⑤ Typed error handling by gRPC status code
try {
  await users.getUser({ id: 'missing' })
} catch (err) {
  if (err instanceof GrpcError && err.code === 'not_found') return null
}
```

[Full gRPC guide →](/guide/grpc)

---

## NestJS Integration

Register HTTP and gRPC clients together in the same module. Inject with the same `@InjectSuperHttp()` decorator — no separate setup needed.

```typescript
// app.module.ts
@Module({
  imports: [
    SuperHttpModule.forFeature([
      // HTTP client
      {
        name:    'PAYMENTS',
        baseURL: 'https://payments.internal',
        preset:  'resilient-api',
      },
      // gRPC client — same module, same decorator
      {
        name:    'USER_SVC',
        grpc:    true,
        address: 'user-service.internal:50051',
        service: UserServiceDef,
        preset:  'resilient-api',
      },
    ]),
  ],
})
export class AppModule {}
```

```typescript
// posts.service.ts
@Injectable()
export class PostsService {
  constructor(
    @InjectSuperHttp('PAYMENTS')
    private readonly payments: HttpClient,

    @InjectSuperHttp('USER_SVC')
    private readonly users: GrpcClient<typeof UserServiceDef>,
  ) {}

  async createPost(dto: CreatePostDto) {
    const [author, charge] = await Promise.all([
      this.users.getUser({ id: dto.authorId }),   // gRPC
      this.payments.post('/charges', dto.payment), // HTTP
    ])
    return { ...dto, author, charge }
  }
}
```

[Full NestJS guide →](/guide/nestjs)

</div>

<style>
.home-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}
.home-content h2 {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 48px 0 16px;
}
.home-content hr {
  margin: 48px 0;
  border: none;
  border-top: 1px solid var(--vp-c-divider);
}
</style>

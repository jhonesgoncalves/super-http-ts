<p align="center">
  <img width="160px" src=".github/images/super-http-logo.svg" align="center" alt="super-http" />
  <h2 align="center">super-http</h2>
  <p align="center"><strong>Built for production, not just requests.</strong></p>
  <p align="center">Production-grade HTTP + gRPC client for Node.js and TypeScript.<br>Circuit breaker · Bulkhead · Rate limiter · Jitter retry · Fallback · Metrics · Plugins · gRPC</p>
</p>

<p align="center">
  <a href="https://github.com/jhonesgoncalves/super-http-ts/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/jhonesgoncalves/super-http-ts/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://www.npmjs.com/package/super-http">
    <img alt="npm version" src="https://img.shields.io/npm/v/super-http?style=flat&color=0ea5e9" />
  </a>
  <a href="https://www.npmjs.com/package/super-http">
    <img alt="npm downloads" src="https://img.shields.io/npm/dw/super-http?style=flat&color=0ea5e9" />
  </a>
  <a href="https://codecov.io/gh/jhonesgoncalves/super-http-ts">
    <img alt="Coverage" src="https://codecov.io/gh/jhonesgoncalves/super-http-ts/branch/main/graph/badge.svg" />
  </a>
  <a href="https://github.com/jhonesgoncalves/super-http-ts/blob/main/LICENSE.md">
    <img alt="License: MIT" src="https://img.shields.io/github/license/jhonesgoncalves/super-http-ts?style=flat&color=0ea5e9" />
  </a>
  <img alt="Node.js" src="https://img.shields.io/node/v/super-http?style=flat&color=0ea5e9" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat" />
</p>

<p align="center">
  <a href="https://jhonesgoncalves.github.io/super-http-ts/"><strong>📖 Documentation</strong></a> ·
  <a href="https://jhonesgoncalves.github.io/super-http-ts/guide/getting-started">Getting Started</a> ·
  <a href="https://jhonesgoncalves.github.io/super-http-ts/guide/grpc">gRPC Guide</a> ·
  <a href="https://jhonesgoncalves.github.io/super-http-ts/guide/why">Why super-http?</a> ·
  <a href="https://jhonesgoncalves.github.io/super-http-ts/guide/benchmarks">Benchmarks</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## Pick the right tool

| Scenario | Best choice |
|---|---|
| One-off script, CLI | `fetch` |
| Standard web app | `axios` |
| Maximum raw throughput | `undici` |
| **Production-critical service** | **super-http** |

---

## Benchmarks

Measured against a local Express server, Node.js 20 · [full report →](https://jhonesgoncalves.github.io/super-http-ts/guide/benchmarks)

| Scenario | Plain axios | super-http | Gain |
|---|---|---|---|
| **Connection pool** (200 req, 50c) | 2 222 req/s | **4 545 req/s** | **+105%** |
| **Retry** on 50% flaky service | 51% success | **96% success** | **+45 pp** |
| **Circuit breaker** during outage | avg 84ms/req | avg **14ms/req** | **−83% latency** |
| **Bulkhead** isolation | p99 = 31ms | p99 = **25ms** | **−19% tail** |
| **Rate limiter** (429 avoidance) | 60% 429 errors | **0% errors** | **zero 429s** |
| **vs. undici** (no pool) | — | **+105%** | auto-pooling |

> Run it yourself: `npm run example`

---

## Installation

```bash
npm install super-http
```

> Node.js ≥ 20 · TypeScript ≥ 5

---

## Quick start — production setup in seconds

```typescript
import { createClient, ExponentialJitterRetryStrategy, LoggerPlugin } from 'super-http'

// One line — circuit breaker + retry + bulkhead, all pre-configured
const api = createClient({
  baseURL: 'https://api.example.com',
  preset: 'resilient-api',
  headers: { Authorization: `Bearer ${token}` },
})

// Add observability
api
  .use(LoggerPlugin({ prefix: '[checkout]' }))
  .on({
    onCircuitStateChange: ({ to, failures }) =>
      to === 'open' && alerts.critical(`Circuit opened (${failures} failures)`),
  })

// Per-request policy for sensitive endpoints
const charge = await api.post('/charges', payload, {
  policy: { retry: false, timeout: 10_000 },
  headers: { 'Idempotency-Key': uuid() },
})

// Built-in metrics — no setup
const { p99Latency, circuitBreakerTrips } = api.metrics()
```

---

## Quick start — gRPC (new in 1.4)

TypeScript-first gRPC with the same resilience pipeline — no `.proto` files required:

```typescript
import { defineService, unary, serverStream, createGrpcClient, GrpcError } from 'super-http/grpc'

// Define the service contract in pure TypeScript
const UserServiceDef = defineService('UserService', {
  getUser:   unary<{ id: string }, User>(),
  listUsers: serverStream<{ active?: boolean }, User>(),
})

// Create a fully resilient client — circuit breaker + retry x3 + bulkhead
const users = createGrpcClient(UserServiceDef, 'grpcs://user-service:443', {
  preset: 'resilient-api',
  headers: { 'x-api-key': process.env.API_KEY! },
})

// Unary call — fully typed, resilience pipeline active
const user = await users.getUser({ id: '42' })

// Server streaming — native AsyncIterable, HTTP/2 backpressure
for await (const u of users.listUsers({ active: true })) {
  await processUser(u)
}

// Error handling — typed by gRPC status code
try {
  await users.getUser({ id: 'missing' })
} catch (err) {
  if (err instanceof GrpcError && err.code === 'not_found') return null
}
```

> **NestJS**: use `SuperHttpModule.forFeature([{ grpc: true, name: 'USER_SVC', address: ..., service: UserServiceDef }])` and inject with `@InjectSuperHttp('USER_SVC')`.
> See the [full gRPC guide →](https://jhonesgoncalves.github.io/super-http-ts/guide/grpc)

---

## Features

| Feature | Method | Description |
|---|---|---|
| **Presets** | `createClient({ preset })` | `high-throughput` · `resilient-api` · `low-latency` |
| **Connection pool** | `pool: { maxSockets }` | Shared keep-alive agent per base URL |
| **Retry** | `.retry(n, strategy)` | Fixed · Exponential · Jitter · Retry-After |
| **Circuit breaker** | `.circuitBreak(config)` | closed → open → half-open |
| **Bulkhead** | `.bulkhead(config)` | Concurrency limiter + bounded queue |
| **Rate limiter** | `.rateLimit(config)` | Token bucket with Retry-After support |
| **Fallback** | `.fallback(fn)` | Graceful degradation |
| **Request dedup** | `.dedup()` | Coalesce identical concurrent GETs |
| **Metrics** | `.metrics()` | p50/p95/p99, retries, CB trips, uptime |
| **Lifecycle hooks** | `.on({ onRequest, onResponse, onError })` | Logging, tracing |
| **Plugins** | `.use(plugin)` | LoggerPlugin, MetricsReporter, custom |
| **Per-request policy** | `{ policy: { retry, fallback, timeout } }` | Override per endpoint |
| **gRPC (new in 1.4)** | `createGrpcClient(def, address)` | TypeScript-first, no `.proto` files, same resilience pipeline |

---

## Documentation

| | |
|---|---|
| 🚀 [Getting started](https://jhonesgoncalves.github.io/super-http-ts/guide/getting-started) | Up and running in 2 minutes |
| 📡 [gRPC Support](https://jhonesgoncalves.github.io/super-http-ts/guide/grpc) | TypeScript-first gRPC — no .proto files |
| 🤔 [Why super-http?](https://jhonesgoncalves.github.io/super-http-ts/guide/why) | Comparison with axios, undici, got |
| 🔀 [Migrating from Axios](https://jhonesgoncalves.github.io/super-http-ts/guide/migration) | Drop-in upgrade guide |
| 🎛️ [Presets](https://jhonesgoncalves.github.io/super-http-ts/guide/presets) | high-throughput · resilient-api · low-latency |
| ⚡ [Circuit Breaker](https://jhonesgoncalves.github.io/super-http-ts/guide/circuit-breaker) | State machine explained |
| 🔄 [Retry Strategies](https://jhonesgoncalves.github.io/super-http-ts/guide/retry) | Jitter, exponential, Retry-After |
| 🧱 [Bulkhead](https://jhonesgoncalves.github.io/super-http-ts/guide/bulkhead) | Isolation pattern |
| 🚦 [Rate Limiter](https://jhonesgoncalves.github.io/super-http-ts/guide/rate-limiter) | Token bucket |
| 🛡️ [Fallback](https://jhonesgoncalves.github.io/super-http-ts/guide/fallback) | Graceful degradation |
| 👁️ [Observability](https://jhonesgoncalves.github.io/super-http-ts/guide/observability) | Hooks, metrics, plugins |
| 🔌 [Plugins](https://jhonesgoncalves.github.io/super-http-ts/guide/plugins) | Logger, MetricsReporter, custom |
| 📋 [Production Readiness](https://jhonesgoncalves.github.io/super-http-ts/guide/production-readiness) | Checklist |
| 📊 [Benchmarks](https://jhonesgoncalves.github.io/super-http-ts/guide/benchmarks) | Real numbers |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

Copyright © 2024 [Jhones Gonçalves](https://github.com/jhonesgoncalves). MIT licensed.

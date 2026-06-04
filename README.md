<p align="center">
  <img width="160px" src=".github/images/super-http-logo.svg" align="center" alt="super-http" />
  <h2 align="center">super-http</h2>
  <p align="center">Enterprise-grade HTTP client for Node.js — circuit breaker, bulkhead, rate limiter,<br>connection pooling, exponential jitter retry, fallback and request deduplication.</p>
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
  <a href="https://jhonesgoncalves.github.io/super-http-ts/api/">API Reference</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## Why super-http?

| Problem in production | super-http solution |
|---|---|
| `ECONNRESET` / socket hung up | Shared `http.Agent` with keep-alive + retry on socket errors |
| New TCP handshake per request | Connection pool per base URL (`maxSockets`, keep-alive) |
| Cascading failures | Three-state circuit breaker (closed → open → half-open) |
| Thundering herd on retries | Exponential backoff with full jitter (AWS-recommended) |
| One slow API monopolising resources | Bulkhead isolation (semaphore + bounded queue) |
| Blowing upstream rate limits | Token-bucket rate limiter with `Retry-After` header support |
| Total failure instead of partial | Fallback handler for graceful degradation |
| Duplicate concurrent GET calls | Request deduplication — one network call, many callers |
| No visibility into resilience events | Hooks: `onRetry`, `onCircuitStateChange`, `onBulkheadReject`… |

---

## Benchmarks

Real numbers measured with 200 concurrent requests against a local Express server (Node.js 20).

| Scenario | Plain axios | super-http | Gain |
|---|---|---|---|
| **Connection pool** (200 req, 20c) | 2 222 req/s · 7.4 ms | **4 545 req/s · 4.3 ms** | **+105% throughput** |
| **Retry** on 50%-flaky service | 51% success | **96% success** | **+45 pp** |
| **Circuit breaker** during outage | waits for full response | **fails in <1 ms** | instant fail-fast |
| **Bulkhead** isolation (fast+slow) | fast-api p99 = 31 ms | fast-api p99 = **25 ms** | **−19% tail latency** |
| **Rate limiter** (25 req, limit 10) | 60% get 429 | **0% get 429** | zero rate-limit errors |

> Run them yourself: `npm run example` — full source in [`example/`](example/)
> · [Full benchmark report →](https://jhonesgoncalves.github.io/super-http-ts/guide/benchmarks)

---

## Installation

```bash
npm install super-http
```

> **Requires Node.js ≥ 20 · TypeScript ≥ 5**

---

## Quick start

```typescript
import { HttpClientFactory, ExponentialJitterRetryStrategy } from 'super-http'

const api = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,
  timeout: 15_000,
})

api
  .on({
    onRetry:              ({ attempt, delayMs }) => console.warn(`retry #${attempt} in ${delayMs}ms`),
    onCircuitStateChange: ({ from, to })         => console.warn(`circuit: ${from} → ${to}`),
  })
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
  .bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
  .rateLimit({ permitLimit: 200, windowMs: 60_000 })
  .fallback(() => ({ items: [], degraded: true }))
  .dedup()

const { data } = await api.get<Item[]>('/items')
```

---

## Features

### 🔌 Connection pool + keep-alive

Shared `http.Agent` and `https.Agent` per base URL. Reuse TCP connections — no handshake overhead, no `ECONNRESET` from stale sockets.

```typescript
HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100, maxFreeSockets: 20, keepAlive: true, timeout: 15_000,
})
```

### 🔄 Retry with pluggable strategies

```typescript
import { ExponentialJitterRetryStrategy, RetryAfterStrategy } from 'super-http'

client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000)) // full jitter (recommended)
client.retry(3, 500)                                              // fixed delay (legacy)
client.retry(5, new RetryAfterStrategy())                         // honours Retry-After header
client.retry(3, 500, [429, 503])                                  // only specific status codes
```

| Strategy | When to use |
|---|---|
| `FixedRetryStrategy(ms)` | Simple cases, low traffic |
| `ExponentialRetryStrategy(init, max)` | Higher traffic, no jitter needed |
| `ExponentialJitterRetryStrategy(init, max)` | **Recommended** — distributed systems, prevents thundering herd |
| `RetryAfterStrategy()` | APIs that return `Retry-After` headers (429/503) |

### ⚡ Circuit breaker

```typescript
client.circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
```

### 🧱 Bulkhead isolation

```typescript
// Max 20 concurrent calls; excess queued up to 100; reject after 3 s in queue
client.bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
```

### 🚦 Rate limiter

```typescript
// 200 requests per minute; queue excess with 5 s max wait
client.rateLimit({ permitLimit: 200, windowMs: 60_000, queueRequests: true, queueTimeoutMs: 5_000 })
```

### 🛡️ Fallback

```typescript
client.fallback((error) => ({ items: [], degraded: true, reason: error.message }))
```

### 🔁 Request deduplication

```typescript
client.dedup() // identical concurrent GETs → one network call, shared result
```

### 👁️ Observability hooks

```typescript
client.on({
  onRetry:              ({ attempt, error, delayMs }) => metrics.increment('retry'),
  onCircuitStateChange: ({ from, to, failures })      => logger.warn(`circuit ${from}→${to}`),
  onBulkheadReject:     ({ active, queued })           => metrics.increment('bulkhead.rejected'),
  onFallback:           ({ error })                   => logger.error('fallback triggered', error),
  onRateLimitReject:    ({ permitLimit, windowMs })   => metrics.increment('rate_limit.rejected'),
})
```

---

## Full API

### `HttpClientFactory.create(baseURL, httpConfig?, poolConfig?)`

Returns (or creates) a singleton `HttpClient` per base URL.

### `HttpClient` methods

| Method | Description |
|---|---|
| `get / post / put / patch / delete` | HTTP convenience methods |
| `.retry(n, strategy, retryOn?)` | Retry with strategy or fixed ms |
| `.circuitBreak(config)` | Circuit breaker |
| `.bulkhead(config)` | Concurrency limiter |
| `.rateLimit(config)` | Token-bucket rate limiter |
| `.fallback(fn)` | Graceful degradation handler |
| `.dedup()` | Request deduplication |
| `.on(events)` | Observability hooks |

All fluent methods return `this`.

---

## Documentation

Full docs at **[jhonesgoncalves.github.io/super-http-ts](https://jhonesgoncalves.github.io/super-http-ts/)**

| | |
|---|---|
| 📖 [Getting started](https://jhonesgoncalves.github.io/super-http-ts/guide/getting-started) | Up and running in 2 minutes |
| 🧱 [Bulkhead](https://jhonesgoncalves.github.io/super-http-ts/guide/bulkhead) | Isolation pattern |
| 🚦 [Rate limiter](https://jhonesgoncalves.github.io/super-http-ts/guide/rate-limiter) | Token bucket |
| 🔄 [Retry strategies](https://jhonesgoncalves.github.io/super-http-ts/guide/retry) | Jitter, exponential, Retry-After |
| ⚡ [Circuit breaker](https://jhonesgoncalves.github.io/super-http-ts/guide/circuit-breaker) | State machine |
| 🛡️ [Fallback](https://jhonesgoncalves.github.io/super-http-ts/guide/fallback) | Graceful degradation |
| 👁️ [Observability](https://jhonesgoncalves.github.io/super-http-ts/guide/observability) | Hooks & events |
| ⚙️ [Configuration](https://jhonesgoncalves.github.io/super-http-ts/guide/configuration) | All options |
| 🍳 [Recipes](https://jhonesgoncalves.github.io/super-http-ts/guide/recipes) | Production patterns |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Copyright © 2024 [Jhones Gonçalves](https://github.com/jhonesgoncalves). MIT licensed.

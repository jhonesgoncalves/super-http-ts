<p align="center">
  <img width="160px" src=".github/images/super-http-logo.svg" align="center" alt="super-http" />
  <h2 align="center">super-http</h2>
  <p align="center">A resilient HTTP client built on top of Axios — circuit breaker, connection pooling, keep-alive and smart retry out of the box.</p>
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
  <a href="https://github.com/jhonesgoncalves/super-http-ts/issues">
    <img alt="Issues" src="https://img.shields.io/github/issues/jhonesgoncalves/super-http-ts?style=flat&color=0ea5e9" />
  </a>
  <img alt="Node.js" src="https://img.shields.io/node/v/super-http?style=flat&color=0ea5e9" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178c6?style=flat" />
</p>

---

## Why super-http?

Node's default HTTP behaviour leaves a lot to be desired in production:

| Problem | super-http solution |
|---|---|
| `ECONNRESET` / socket hung up on keep-alive connections | Shared `http.Agent` with `keepAlive: true` and automatic retry on socket errors |
| New TCP handshake for every request | Connection pool (`maxSockets`, `maxFreeSockets`) shared per base URL |
| Cascading failures from a flaky dependency | Three-state circuit breaker (closed → open → half-open) |
| Repetitive retry boilerplate | `.retry(n, delayMs)` with smart 5xx / network-error detection |

---

## Installation

```bash
npm install super-http
# or
yarn add super-http
```

> **Requires Node.js ≥ 16**

---

## Quick start

```typescript
import { HttpClientFactory } from 'super-http';

const api = HttpClientFactory.create('https://api.example.com');

const { data: users } = await api.get('/users');
const { data: user }  = await api.post('/users', { name: 'Alice' });
```

---

## Features

### 🔌 Connection pool + keep-alive

`HttpClientFactory.create` returns a **singleton per base URL** backed by shared `http.Agent` and `https.Agent` instances. TCP connections are reused across requests — no handshake overhead, no stale-socket `ECONNRESET`.

```typescript
const client = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,       // max concurrent sockets per host   (default: 50)
  maxFreeSockets: 20,    // idle keep-alive sockets            (default: 10)
  keepAlive: true,       // reuse TCP connections              (default: true)
  keepAliveMsecs: 2000,  // keep-alive probe interval (ms)    (default: 1000)
  timeout: 15_000,       // request timeout (ms)              (default: 30000)
});
```

### 🔄 Smart retry

Retries automatically on **network errors** (`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `EPIPE`, …) and **HTTP 5xx** responses. Never retries 4xx — those are client errors and retrying won't help.

```typescript
client.retry(3, 500);                // up to 3 retries, 500 ms between each
client.retry(3, 500, [429, 503]);    // retry only specific status codes
```

### ⚡ Circuit breaker

Trips after `failureThreshold` consecutive failures. While open, requests fail immediately — no waiting for timeouts. After `timeoutMs` the circuit enters **half-open** state and allows a single probe through.

```typescript
client.circuitBreak({
  failureThreshold: 5,   // trip after 5 failures
  successThreshold: 2,   // close after 2 consecutive successes
  timeoutMs: 10_000,     // probe again after 10 s
});
```

Circuit states:

```
        failures >= threshold
CLOSED ──────────────────────► OPEN
  ▲                               │
  │  successes >= threshold   timeoutMs elapsed
  │                               ▼
  └──────────────────────── HALF-OPEN
```

### 🔗 Fluent chaining

```typescript
HttpClientFactory.create('https://api.example.com')
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500)
  .get('/health');
```

---

## API Reference

### `HttpClientFactory.create(baseURL, httpConfig?, poolConfig?)`

Returns (or creates) a singleton `HttpClient` for the given base URL.

| Param | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests |
| `httpConfig` | `HttpClientRequestConfig` | Default Axios config (headers, auth, …) |
| `poolConfig` | `PoolConfig` | Connection pool options |

### `HttpClient` — HTTP methods

| Method | Signature |
|---|---|
| `get` | `get<T>(url, config?)` |
| `post` | `post<T>(url, data?, config?)` |
| `put` | `put<T>(url, data?, config?)` |
| `patch` | `patch<T>(url, data?, config?)` |
| `delete` | `delete<T>(url, config?)` |
| `request` | `request<T>(axiosConfig)` |

### `HttpClient` — Resilience

| Method | Description |
|---|---|
| `.retry(retries, delayMs, retryOn?)` | Configure retry — returns `this` |
| `.circuitBreak(config)` | Configure circuit breaker — returns `this` |

### `HttpClientFactory.clear()`

Clears all cached instances. Useful in tests:

```typescript
afterEach(() => HttpClientFactory.clear());
```

---

## Full example

```typescript
import { HttpClientFactory } from 'super-http';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

const api = HttpClientFactory.create('https://jsonplaceholder.typicode.com', {}, {
  maxSockets: 50,
  timeout: 10_000,
});

api
  .circuitBreak({ failureThreshold: 3, successThreshold: 2, timeoutMs: 8_000 })
  .retry(3, 500);

// GET
const { data: todos } = await api.get<Todo[]>('/todos');

// POST
const { data: newTodo } = await api.post<Todo>('/todos', {
  title: 'Buy milk',
  completed: false,
});

// Error handling
try {
  await api.get('/flaky-service');
} catch (err: any) {
  if (err.message === 'Circuit breaker is open') {
    console.warn('Service unavailable — circuit is open');
  }
}
```

---

## Documentation

| | |
|---|---|
| 📖 [Getting started](docs/getting-started.md) | First request in 2 minutes |
| ⚙️ [Configuration reference](docs/configuration.md) | All options explained |
| 🍳 [Recipes & patterns](docs/recipes.md) | Production-ready patterns |
| 🔬 [API reference](docs/api/) | Auto-generated from JSDoc |

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full history of changes.

## License

Copyright © 2024 [Jhones Gonçalves](https://github.com/jhonesgoncalves). MIT licensed — see [LICENSE.md](LICENSE.md).

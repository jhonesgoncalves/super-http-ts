<p align="center">
  <img width="140px" src=".github/images/super-http-logo.svg" align="center" alt="super-http" />
  <h2 align="center">super-http</h2>
  <p align="center">A resilient HTTP client built on top of Axios — circuit breaker, connection pooling, keep-alive and smart retry out of the box.</p>
  <p align="center">
    <a href="https://github.com/hebertcisco/super-http/issues">
      <img alt="Issues" src="https://img.shields.io/github/issues/hebertcisco/super-http?style=flat&color=0ea5e9" />
    </a>
    <a href="https://github.com/hebertcisco/super-http/pulls">
      <img alt="Pull Requests" src="https://img.shields.io/github/issues-pr/hebertcisco/super-http?style=flat&color=0ea5e9" />
    </a>
    <a href="https://www.npmjs.com/package/super-http">
      <img alt="npm version" src="https://img.shields.io/npm/v/super-http?style=flat&color=0ea5e9" />
    </a>
    <a href="https://www.npmjs.com/package/super-http">
      <img alt="npm downloads" src="https://img.shields.io/npm/dw/super-http?style=flat&color=0ea5e9" />
    </a>
    <a href="LICENSE.md">
      <img alt="License" src="https://img.shields.io/github/license/hebertcisco/super-http?style=flat&color=0ea5e9" />
    </a>
  </p>
</p>

---

## Why super-http?

Node's default HTTP behaviour leaves a lot to be desired in production:

- **Socket hung up** — when a server closes a keep-alive connection your client gets `ECONNRESET`. super-http retries those transparently.
- **No connection pool** — without a shared agent every request opens a new socket. super-http creates a single `http.Agent` / `https.Agent` per base URL with configurable `maxSockets` and `keepAlive`.
- **No resilience** — a flaky dependency can cascade into full outages. The built-in **circuit breaker** trips after N failures and gives the dependency time to recover before trying again.
- **Verbose retry logic** — writing your own `while (retries--)` with back-off is boilerplate. super-http gives you `.retry(n, delayMs)`.

---

## Installation

```bash
npm install super-http
# or
yarn add super-http
```

---

## Quick start

```typescript
import { HttpClientFactory } from 'super-http';

const client = HttpClientFactory.create('https://api.example.com');

// Convenience methods
const { data } = await client.get('/users');
const { data: user } = await client.post('/users', { name: 'Alice' });
```

---

## Features

### Connection pool + keep-alive

`HttpClientFactory.create` returns a **singleton per base URL** backed by a shared `http.Agent` and `https.Agent`. Connections are reused across requests, eliminating TCP handshake overhead and preventing `ECONNRESET` from stale sockets.

```typescript
const client = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,       // max concurrent connections per host (default: 50)
  maxFreeSockets: 20,    // idle connections kept alive (default: 10)
  keepAlive: true,       // reuse TCP connections (default: true)
  keepAliveMsecs: 2000,  // keep-alive probe interval in ms (default: 1000)
  timeout: 15000,        // request timeout in ms (default: 30000)
});
```

### Retry

Retries on network errors (`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `EPIPE`, …) and 5xx responses. You can also pin it to specific status codes.

```typescript
client
  .retry(3, 500)              // up to 3 retries, 500 ms between each
  .get('/unstable-endpoint');

// Retry only on specific status codes
client
  .retry(3, 500, [429, 503])
  .get('/rate-limited');
```

### Circuit breaker

Trips after `failureThreshold` consecutive failures within `timeoutMs`. While open, requests fail fast with `"Circuit breaker is open"`. After `timeoutMs` elapses, a single probe is allowed through; on success the circuit closes.

```typescript
client
  .circuitBreak({
    failureThreshold: 5,   // trip after 5 failures
    successThreshold: 2,   // close after 2 consecutive successes
    timeoutMs: 10000,      // stay open for 10 s before probing
  })
  .get('/service');
```

### Chaining

Both `.retry()` and `.circuitBreak()` return `this`, so they chain naturally:

```typescript
const client = HttpClientFactory.create('https://api.example.com');

client
  .circuitBreak({ failureThreshold: 3, successThreshold: 2, timeoutMs: 6000 })
  .retry(3, 1000)
  .get('/health');
```

---

## API

### `HttpClientFactory.create(baseURL, httpConfig?, poolConfig?)`

Returns a singleton `HttpClient` for the given base URL. Subsequent calls with the same URL return the cached instance.

| Param | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests |
| `httpConfig` | `HttpClientRequestConfig` | Axios request config applied to every request |
| `poolConfig` | `PoolConfig` | Connection pool options (see above) |

### `HttpClient` methods

| Method | Description |
|---|---|
| `get(url, config?)` | HTTP GET |
| `post(url, data?, config?)` | HTTP POST |
| `put(url, data?, config?)` | HTTP PUT |
| `patch(url, data?, config?)` | HTTP PATCH |
| `delete(url, config?)` | HTTP DELETE |
| `request(config)` | Raw Axios request |
| `retry(retries, delayMs, retryOn?)` | Configure retry — returns `this` |
| `circuitBreak(config)` | Configure circuit breaker — returns `this` |

### `PoolConfig`

| Option | Default | Description |
|---|---|---|
| `maxSockets` | `50` | Max concurrent sockets per host |
| `maxFreeSockets` | `10` | Max idle keep-alive sockets |
| `keepAlive` | `true` | Enable TCP keep-alive |
| `keepAliveMsecs` | `1000` | Keep-alive probe interval (ms) |
| `timeout` | `30000` | Request timeout (ms) |

### `CircuitBreakerConfig`

| Option | Description |
|---|---|
| `failureThreshold` | Number of failures before the circuit trips |
| `successThreshold` | Consecutive successes needed to close the circuit |
| `timeoutMs` | How long to keep the circuit open before probing |

---

## Full example

```typescript
import { HttpClientFactory } from 'super-http';

const api = HttpClientFactory.create('https://jsonplaceholder.typicode.com', {}, {
  maxSockets: 50,
  timeout: 10000,
});

api
  .circuitBreak({ failureThreshold: 3, successThreshold: 2, timeoutMs: 8000 })
  .retry(3, 500);

// Reuse the same instance anywhere — connections are pooled automatically
const { data: todos } = await api.get('/todos');
const { data: todo } = await api.post('/todos', { title: 'Buy milk', completed: false });
```

---

## Contributing

Contributions, issues and feature requests are welcome! Check the [issues page](https://github.com/hebertcisco/super-http/issues).

## License

Copyright © 2024 [Jhones Gonçalves](https://github.com/jhonesgoncalves). MIT licensed — see [LICENSE.md](LICENSE.md).

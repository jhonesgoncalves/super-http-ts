# Connection Pooling

## How it works

super-http creates a shared `http.Agent` and `https.Agent` per base URL. Every request to the same host reuses open TCP connections from the pool instead of opening a new one.

```
Request 1 ──► [pool] ──► TCP conn A ──► api.example.com
Request 2 ──► [pool] ──► TCP conn A ──► api.example.com  (reused!)
Request 3 ──► [pool] ──► TCP conn B ──► api.example.com  (new, A is busy)
```

---

## Why keep-alive matters

Without keep-alive, each request goes through:

```
1. DNS lookup      ~1–50 ms
2. TCP handshake   ~1 RTT
3. TLS handshake   ~1–2 RTT  (for HTTPS)
4. HTTP request    ~1 RTT
```

With keep-alive, steps 1–3 happen once and are reused for all subsequent requests.

### The ECONNRESET problem

Servers often close idle connections after a timeout (e.g. 60 s on nginx). If your client has the connection in its pool and tries to use it after the server closed it, you get:

```
Error: socket hang up (ECONNRESET)
```

super-http solves this two ways:
1. `keepAliveMsecs` sends TCP keep-alive probes to detect dead connections early
2. Retry on `ECONNRESET` — even if a stale socket slips through, the request is retried transparently

---

## Configuration

```typescript
const client = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 50,        // max concurrent open sockets per host
  maxFreeSockets: 10,    // max idle sockets to keep open
  keepAlive: true,       // enable TCP keep-alive
  keepAliveMsecs: 1000,  // probe interval (ms)
  timeout: 30_000,       // request timeout (ms)
})
```

### Tuning for your workload

| Workload | `maxSockets` | `maxFreeSockets` |
|---|---|---|
| Low traffic API | 10–20 | 5 |
| High throughput service | 100–200 | 20–50 |
| Background jobs | 5–10 | 2–5 |

::: tip
Setting `maxSockets` too high can overwhelm the upstream server. A good starting point is `50` and tune up from there based on your upstream's capacity.
:::

---

## Singleton per base URL

`HttpClientFactory` caches instances by base URL:

```typescript
const a = HttpClientFactory.create('https://api.example.com')
const b = HttpClientFactory.create('https://api.example.com')

console.log(a === b) // true — same pool, same agent
```

This means the pool is shared across the entire application. Import `HttpClientFactory.create(...)` anywhere and you always get the same pre-warmed connection pool.

```typescript
// service-a.ts
import { HttpClientFactory } from 'super-http'
export const api = HttpClientFactory.create('https://api.example.com')

// service-b.ts — same pool, no duplicate agents
import { HttpClientFactory } from 'super-http'
const api = HttpClientFactory.create('https://api.example.com')
```

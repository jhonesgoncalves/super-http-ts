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
2. Retry on `ECONNRESET` — even if a stale socket slips through, the request is retried transparently for idempotent methods (see [Retry](./retry#what-gets-retried))
3. `socketTimeoutMs` bounds how long a socket may sit inactive before the agent gives up on it

---

## Configuration

```typescript
const client = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 200,          // max concurrent open sockets per host
  maxFreeSockets: 50,       // max idle sockets to keep open
  keepAlive: true,          // enable TCP keep-alive
  keepAliveMsecs: 1000,     // probe interval (ms)
  timeout: 30_000,          // response timeout (ms)
  socketTimeoutMs: 30_000,  // socket inactivity timeout on the agent
})
```

### `timeout` vs `socketTimeoutMs`

`timeout` is the axios response timeout — how long to wait for an answer.
`socketTimeoutMs` goes to the `http.Agent` itself and bounds **socket
inactivity**, which is what catches a connection silently dropped by a NAT or a
firewall. Node's agent exposes no separate connect timeout, so inactivity covers
a stuck connect too.

::: warning Fixed in 2.0
Before 2.0, `timeout` was read out of the pool config and used **only** as the
axios response timeout — it never reached the agent, so nothing bounded a socket
that simply went quiet.
:::

### Tuning for your workload

| Workload | `maxSockets` | `maxFreeSockets` |
|---|---|---|
| Low traffic API | 10–20 | 5 |
| High throughput service | 100–200 | 20–50 |
| Background jobs | 5–10 | 2–5 |

::: tip Sizing is about burst headroom, not average load
Steady-state demand is `rps × latencySeconds` (Little's Law): 58 rps at 200 ms is
only about **12 sockets**. The default of 200 is not sized for average throughput
— it is headroom for when upstream latency degrades. At a p99 of 2 s, that same
58 rps wants ~116 sockets.

Compute the steady-state figure, then size for your worst plausible latency.
Setting it far higher than the upstream can absorb just moves the queue.
:::

---

## Releasing the pool

Dropping the client reference is not enough: the agents keep their keep-alive
sockets open until the remote or the OS closes them.

```typescript
await client.close()       // destroys both agents' sockets, clears plugin timers
HttpClientFactory.clear()  // closes every cached client, then empties the cache
```

::: warning Fixed in 2.0
`HttpClientFactory.clear()` used to just empty the cache map, leaking a connection
pool per invocation — including in the test-isolation flow it is recommended for.
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

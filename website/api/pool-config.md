# PoolConfig

Options for the underlying `http.Agent` / `https.Agent` connection pool.

```typescript
interface PoolConfig {
  freeSocketTimeoutMs?: number
  maxSocketAgeMs?: number
  keepAliveTimeoutBufferMs?: number
  scheduling?: 'lifo' | 'fifo'
  maxSockets?: number
  maxFreeSockets?: number
  keepAlive?: boolean
  keepAliveMsecs?: number
  timeout?: number
  socketTimeoutMs?: number
  maxContentLength?: number
  maxBodyLength?: number
}
```

---

## Options

### `maxSockets`

- **Type:** `number`
- **Default:** `200`
- **Must be** `>= 1` — Node reads `0` as *unlimited*, the opposite of what it
  looks like, so it is rejected.

Maximum number of concurrent open sockets per host. Requests beyond this limit are queued.

Sized for burst headroom, not average load: steady-state demand is
`rps × latencySeconds`, so 58 rps at 200 ms needs only about 12 sockets. The
default matters when latency degrades.

### `maxFreeSockets`

- **Type:** `number`
- **Default:** `50`

Maximum number of idle (keep-alive) sockets to keep open. Sockets above this limit are destroyed when idle.

### `keepAlive`

- **Type:** `boolean`
- **Default:** `true`

Enables TCP keep-alive. **Strongly recommended** — prevents `ECONNRESET` when servers close idle connections.

### `keepAliveMsecs`

- **Type:** `number`
- **Default:** `1000`

Interval in milliseconds between TCP keep-alive probes. Lower values detect dead connections sooner but increase network overhead.

### `timeout`

- **Type:** `number`
- **Default:** `30000`

**Response** timeout in milliseconds — how long to wait for the upstream to answer.
Can be overridden per-request via `config.timeout` or `policy.timeout`.

This bounds a single attempt. To bound a whole call (queue waits + all attempts +
all backoff), use [`client.deadline(ms)`](../guide/deadlines).

### `socketTimeoutMs`

- **Type:** `number`
- **Default:** same as `timeout`

Native socket inactivity timeout passed to the Agent. Active requests also use
Axios timeout/cancellation; this is not a separate connect-timeout guarantee.
Use `freeSocketTimeoutMs` for an idle-only cap and a total deadline for the call.

### `maxContentLength`

- **Type:** `number`
- **Default:** `33554432` (32 MiB)

Maximum response body accepted. Axios itself defaults to unlimited, so a runaway
upstream could exhaust the client's memory.

### `maxBodyLength`

- **Type:** `number`
- **Default:** `33554432` (32 MiB)

Maximum request body sent.

---

## Usage

```typescript
import { HttpClientFactory } from 'super-http'

const client = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 200,
  maxFreeSockets: 50,
  keepAlive: true,
  keepAliveMsecs: 2_000,
  timeout: 15_000,
  socketTimeoutMs: 15_000,
})
```

## Idle retirement (2.1)

`freeSocketTimeoutMs` caps idle time only; omitted preserves the native timeout,
and `0` disables this additional cap. `maxSocketAgeMs` retires aged sockets when
they become idle. `keepAliveTimeoutBufferMs` subtracts a margin from server hints
(default 1000 ms). A stricter native protection is never weakened. `scheduling`
defaults to `lifo`. These options do not interrupt active requests.

See [Connection lifecycle](../guide/connection-recovery) for defaults, limits and
the distinction between Axios timeout, Agent inactivity and total deadline.

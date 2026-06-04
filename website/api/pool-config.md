# PoolConfig

Options for the underlying `http.Agent` / `https.Agent` connection pool.

```typescript
interface PoolConfig {
  maxSockets?: number
  maxFreeSockets?: number
  keepAlive?: boolean
  keepAliveMsecs?: number
  timeout?: number
}
```

---

## Options

### `maxSockets`

- **Type:** `number`
- **Default:** `50`

Maximum number of concurrent open sockets per host. Requests beyond this limit are queued.

### `maxFreeSockets`

- **Type:** `number`
- **Default:** `10`

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

Request timeout in milliseconds. Can be overridden per-request via `config.timeout`.

---

## Usage

```typescript
import { HttpClientFactory } from 'super-http'

const client = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,
  maxFreeSockets: 20,
  keepAlive: true,
  keepAliveMsecs: 2_000,
  timeout: 15_000,
})
```

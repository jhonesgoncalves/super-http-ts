# Configuration Reference

## HttpClientFactory.create

```typescript
HttpClientFactory.create(baseURL, httpConfig?, poolConfig?)
```

| Parameter | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL prepended to every request path |
| `httpConfig` | `HttpClientRequestConfig` | Default Axios config (headers, auth, params, …) |
| `poolConfig` | `PoolConfig` | Connection pool options |

---

## PoolConfig

Controls the underlying `http.Agent` / `https.Agent`.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxSockets` | `number` | `200` | Max concurrent open sockets per host (≥ 1) |
| `maxFreeSockets` | `number` | `50` | Max idle keep-alive sockets per host |
| `keepAlive` | `boolean` | `true` | Enable TCP keep-alive to prevent `ECONNRESET` |
| `keepAliveMsecs` | `number` | `1000` | Delay between keep-alive probes (ms) |
| `timeout` | `number` | `30000` | Request timeout (ms) |

```typescript
const client = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,
  maxFreeSockets: 25,
  keepAlive: true,
  keepAliveMsecs: 2000,
  timeout: 15_000,
});
```

---

## retry(retries, delayMs, retryOn?)

| Parameter | Type | Description |
|---|---|---|
| `retries` | `number` | Maximum number of retry attempts |
| `delayMs` | `number` | Fixed delay between attempts (ms) |
| `retryOn` | `number[]` | Optional HTTP status codes to retry, **in addition to** the network-error rules (additive since 2.0) |
| `retryNonIdempotent` | `boolean` | Retry `POST`/`PATCH` on ambiguous errors. `false` by default |

```typescript
// Retry any network error or 5xx
client.retry(3, 500);

// Retry only on 429 (rate-limited) and 503 (unavailable)
client.retry(5, 1000, [429, 503]);
```

**Retryable by default:**
- `ECONNRESET` — server closed a keep-alive connection
- `ECONNREFUSED` — port not listening
- `ETIMEDOUT` — request timed out
- `EPIPE` — broken pipe
- `ENOTFOUND` / `EAI_AGAIN` — DNS failure
- `ECONNABORTED` — connection aborted
- HTTP `5xx` — server-side errors

**Never retried:** HTTP `4xx` (client errors).

---

## circuitBreak(config)

### CircuitBreakerConfig

| Option | Type | Description |
|---|---|---|
| `failureThreshold` | `number` | Consecutive failures before the circuit trips (opens) |
| `successThreshold` | `number` | Consecutive successes in half-open state to close the circuit |
| `timeoutMs` | `number` | Milliseconds the circuit stays open before allowing a probe |

### State machine

```
        failures >= threshold
CLOSED ──────────────────────► OPEN
  ▲                               │
  │ successes >= threshold    timeoutMs elapsed
  │                               ▼
  └──────────────────────── HALF-OPEN
          probe succeeds
```

- **Closed** — requests flow normally.
- **Open** — every request throws `Error('Circuit breaker is open')` immediately.
- **Half-open** — one probe is allowed. Success → closed. Failure → open (timeout resets).

```typescript
client.circuitBreak({
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 10_000,
});
```

---

## HttpClient methods

| Method | Signature | Description |
|---|---|---|
| `get` | `get<T>(url, config?)` | HTTP GET |
| `post` | `post<T>(url, data?, config?)` | HTTP POST |
| `put` | `put<T>(url, data?, config?)` | HTTP PUT |
| `patch` | `patch<T>(url, data?, config?)` | HTTP PATCH |
| `delete` | `delete<T>(url, config?)` | HTTP DELETE |
| `request` | `request<T>(config)` | Raw Axios config |
| `retry` | `retry(n, delayMs, retryOn?)` | Configure retry — returns `this` |
| `circuitBreak` | `circuitBreak(config)` | Configure circuit breaker — returns `this` |

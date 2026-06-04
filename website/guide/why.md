# Why super-http?

Node's default HTTP behaviour has several failure modes that bite you in production.

---

## The problems

### ECONNRESET / socket hung up

When a server closes an idle keep-alive connection, Node's default HTTP client throws `ECONNRESET` — the dreaded **socket hang up** — and your request fails.

```
Error: socket hang up
    at connResetException (node:internal/errors:720:14)
    at TLSSocket.socketOnEnd (node:_http_client:518:23)
```

super-http uses `http.Agent` with `keepAlive: true` and retries on `ECONNRESET` automatically.

### No connection pool by default

Without a shared agent, every `axios.create()` call or every request to the same host opens a new TCP connection. At scale:

- Latency spikes from repeated handshakes
- File descriptor exhaustion
- Load balancer connection storms

super-http creates **one pool per base URL** and shares it across the entire app.

### Cascading failures

Without a circuit breaker, when a dependency is down every request waits the full timeout (30 s, 60 s…), threads pile up, and your service falls over too.

```
Your service → times out → upstream → times out → next upstream…
```

super-http's circuit breaker **fails fast** — when the downstream is unhealthy, requests return immediately with a clear error instead of hanging.

### Retry boilerplate

Writing correct retry logic is surprisingly hard:

```typescript
// don't do this — it's wrong in subtle ways
for (let i = 0; i < 3; i++) {
  try {
    return await axios.get(url)
  } catch (e) {
    if (i === 2) throw e
    await sleep(500)
  }
}
```

- It retries 404s (pointless)
- It retries 401s (makes rate-limiting worse)
- It swallows the original error type
- No circuit breaker awareness

super-http's `.retry()` is aware of error types, respects the circuit breaker state, and never retries client errors.

---

## The solution

| Problem | super-http |
|---|---|
| `ECONNRESET` on keep-alive | `http.Agent` with `keepAlive: true` + retry on socket errors |
| New TCP per request | Shared pool per base URL (`maxSockets`, `maxFreeSockets`) |
| Cascading timeouts | Circuit breaker: trip → open → half-open → recover |
| Retry boilerplate | `.retry(n, delayMs)` with smart 5xx/network detection |
| Verbose setup | `HttpClientFactory.create()` — one call, everything configured |

---

## Comparison

|  | axios (plain) | axios-retry | super-http |
|---|:---:|:---:|:---:|
| Connection pool | ❌ | ❌ | ✅ |
| Keep-alive | ❌ | ❌ | ✅ |
| Smart retry | ❌ | ⚠️ | ✅ |
| Circuit breaker | ❌ | ❌ | ✅ |
| Singleton factory | ❌ | ❌ | ✅ |
| TypeScript | ✅ | ✅ | ✅ |

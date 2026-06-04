# Why super-http?

## The problems with plain HTTP clients

### ECONNRESET / socket hung up

When a server closes an idle keep-alive connection, Node.js throws `ECONNRESET`:

```
Error: socket hang up
    at connResetException (node:internal/errors:720:14)
```

super-http uses `http.Agent` with `keepAlive: true` and retries `ECONNRESET` automatically.

### Thundering herd on retry

When many clients fail simultaneously and all retry at the same fixed delay, they hit the upstream simultaneously — creating a new failure wave. **Full-jitter exponential backoff** spreads retries randomly across time.

```
Fixed delay (bad):   client1 retry ──── client2 retry ──── client3 retry
                     all at t+500ms      all at t+500ms  ← stampede

Jitter (good):       client1 retry at t+237ms
                     client2 retry at t+489ms   ← spread out, no stampede
                     client3 retry at t+61ms
```

### Cascading failures

Without a circuit breaker, when a dependency is down every request waits the full timeout (30 s), threads pile up, and your service falls over too.

super-http's circuit breaker **fails fast** — while the circuit is open, requests return immediately with a clear error.

### Resource monopolisation

Without bulkhead isolation, one slow or broken dependency can consume all your concurrent capacity, blocking unrelated services.

```
Without bulkhead:                   With bulkhead (maxConcurrent: 5):
  slow-api: 50 concurrent calls       slow-api: max 5 calls
  fast-api: 0 slots left   ← blocked  fast-api: unaffected ✓
```

### Upstream rate limits

Clients that don't respect server rate limits get 429s, circuit-breaker trips, and eventually bans. super-http's token-bucket rate limiter enforces outgoing request rates, and `RetryAfterStrategy` waits exactly as long as the server says.

---

## Comparison

|  | axios (plain) | axios-retry | **super-http** |
|---|:---:|:---:|:---:|
| Connection pool | ❌ | ❌ | ✅ |
| Keep-alive | ❌ | ❌ | ✅ |
| Smart retry (skip 4xx) | ❌ | ⚠️ | ✅ |
| Jitter backoff | ❌ | ❌ | ✅ |
| Retry-After header | ❌ | ❌ | ✅ |
| Circuit breaker | ❌ | ❌ | ✅ |
| Bulkhead | ❌ | ❌ | ✅ |
| Rate limiter | ❌ | ❌ | ✅ |
| Fallback | ❌ | ❌ | ✅ |
| Request dedup | ❌ | ❌ | ✅ |
| Observability hooks | ❌ | ❌ | ✅ |
| TypeScript | ✅ | ✅ | ✅ |

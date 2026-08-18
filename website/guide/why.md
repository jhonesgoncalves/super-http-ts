# Why super-http?

> **Axios resolves HTTP requests. super-http resolves production problems.**

---

## Pick the right tool

| Scenario | Best choice |
|---|---|
| One-off script, CLI tool | `fetch` |
| Standard web application | `axios` |
| Maximum raw throughput | `undici` |
| **Production-critical service** | **super-http** |

super-http is not trying to be the fastest raw HTTP client. It's the layer **above raw HTTP** — where reliability, observability, and resilience live.

---

## The problems that hurt production

### ECONNRESET / socket hung up

Servers close idle keep-alive connections after a timeout. Node's default HTTP client throws `ECONNRESET` when it tries to reuse a stale socket.

```
Error: socket hang up (ECONNRESET)
    at connResetException (node:internal/errors:720:14)
```

super-http creates a shared `http.Agent` per base URL with `keepAlive: true`. Stale socket errors are also retried transparently.

### Thundering herd on retry

When many clients fail simultaneously and all retry with the same fixed delay, they hit the upstream at the same moment — creating a new failure wave:

```
Fixed delay:  retry at t+500ms (all 1000 clients at once) → stampede
Jitter:       retry at t+61ms, t+237ms, t+489ms… → spread out
```

`ExponentialJitterRetryStrategy` uses full jitter (AWS-recommended) to prevent this.

### Cascading failures

Without a circuit breaker, a slow dependency exhausts your thread pool — one bad service brings down everything else:

```
Your service → times out 30s → upstream A → times out 30s → upstream B…
```

super-http's circuit breaker **fails fast** while the upstream is unhealthy. Requests that would block for 30 s instead return in `< 1ms`.

### Resource starvation

A slow API hogging all concurrency starves fast, healthy services:

```
Without bulkhead: slow-api takes all 50 slots → fast-api gets 0
With bulkhead:    slow-api capped at 5 → fast-api gets the rest
```

### Rate-limit cascades

Hitting 429 without `Retry-After` awareness causes retry storms. super-http's `RetryAfterStrategy` waits exactly as long as the server instructs.

---

## Benchmark summary

Measured against a local Express server, Node.js 20 ([full results →](./benchmarks)):

| Scenario | Plain axios | super-http | Gain |
|---|---|---|---|
| Connection pool | 2 222 req/s | **4 545 req/s** | **+105% throughput** |
| 50%-flaky service | 51% success | **96% success** | **+45 pp** |
| Circuit breaker during outage | avg 84ms/req | avg **14ms/req** | **−83% latency** |
| Bulkhead isolation | p99 = 31ms | p99 = **25ms** | **−19% tail latency** |
| Rate limiter (429 avoidance) | 60% error | **0% error** | **zero 429s** |
| vs. undici (no pool) | — | **+105% throughput** | auto-pooling wins |

---

## Comparison with other clients

| | fetch | axios | undici | got | **super-http** |
|---|:---:|:---:|:---:|:---:|:---:|
| Connection pool | ❌ | ❌ | ⚠️ manual | ❌ | ✅ auto |
| Keep-alive | ❌ | ❌ | ⚠️ manual | ❌ | ✅ default |
| Smart retry | ❌ | ❌ | ❌ | ✅ basic | ✅ advanced |
| Jitter backoff | ❌ | ❌ | ❌ | ❌ | ✅ |
| Circuit breaker | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bulkhead | ❌ | ❌ | ❌ | ❌ | ✅ |
| Rate limiter | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fallback | ❌ | ❌ | ❌ | ❌ | ✅ |
| Request dedup | ❌ | ❌ | ❌ | ❌ | ✅ |
| Built-in metrics | ❌ | ❌ | ❌ | ❌ | ✅ |
| Observability hooks | ❌ | ❌ | ❌ | ❌ | ✅ |
| Plugin system | ❌ | ❌ | ❌ | ❌ | ✅ |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## The mental model

Think of super-http as a **pipeline** of resilience policies that wraps every HTTP call:

```
retry → bulkhead → rate-limiter → circuit-breaker → axios → fallback
```

Each layer is optional and independent. You configure exactly as much resilience as your use-case requires — from zero (a glorified axios instance) to the full stack for payment gateways.

The order is deliberate: retry sits outside the limiters, so a request does not
hold a concurrency slot while it sleeps through backoff, and every attempt — not
just the first — takes a rate-limiter token.

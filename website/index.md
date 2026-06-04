---
layout: home

hero:
  name: "super-http"
  text: "Enterprise HTTP for Node.js"
  tagline: Circuit breaker, bulkhead, rate limiter, jitter retry, fallback and request dedup — built for distributed systems at scale.
  image:
    src: /logo.svg
    alt: super-http
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: View on GitHub
      link: https://github.com/jhonesgoncalves/super-http-ts

features:
  - icon: 🔌
    title: Connection Pooling
    details: Shared http.Agent and https.Agent per base URL. TCP keep-alive prevents ECONNRESET from stale sockets and eliminates handshake overhead.

  - icon: 🔄
    title: Jitter Retry
    details: Pluggable strategies — fixed, exponential, or full-jitter (AWS-recommended). RetryAfterStrategy honours the server's Retry-After header automatically.

  - icon: ⚡
    title: Circuit Breaker
    details: Three-state machine (closed → open → half-open). Fail fast when upstream is down instead of waiting for timeouts to pile up.

  - icon: 🧱
    title: Bulkhead Isolation
    details: Semaphore with bounded queue limits concurrent calls per service. One slow dependency can't consume all your resources.

  - icon: 🚦
    title: Rate Limiter
    details: Token-bucket rate limiter with queueing and Retry-After-aware backoff. Never accidentally DDoS your own dependencies.

  - icon: 🛡️
    title: Fallback
    details: Register a graceful degradation handler invoked when all policies are exhausted. Return cached data, a default value, or call an alternative source.

  - icon: 🔁
    title: Request Deduplication
    details: Coalesces identical concurrent GET calls into a single network request. All callers share the same response — zero waste.

  - icon: 👁️
    title: Observability Hooks
    details: Fire-and-forget event hooks on every resilience transition — retry, circuit state change, bulkhead reject, fallback, rate limit. Wire directly to your metrics system.
---

<div class="home-content">

## Proven by benchmarks

Real numbers, real Node.js, real concurrent load — [see full results →](/guide/benchmarks)

| Scenario | Plain axios | super-http | Gain |
|---|---|---|---|
| Connection pool (200 req, 20c) | 2 222 req/s | **4 545 req/s** | **+105% throughput** |
| 50% flaky service (150 req) | **51%** success | **96%** success | **+44.7 pp** |
| Circuit breaker during outage | waits for response | **fails in <1 ms** | **instant fail-fast** |
| Bulkhead isolation (fast+slow) | fast-api p99 = 31 ms | fast-api p99 = **25 ms** | **−19% tail latency** |
| Rate limiter (25 req, limit 10) | **60% get 429** | **0% get 429** | **zero rate-limit errors** |

---

## One fluent chain. Full resilience.

```typescript
import { HttpClientFactory, ExponentialJitterRetryStrategy } from 'super-http'

const api = HttpClientFactory.create('https://api.example.com', {}, {
  maxSockets: 100,
  timeout: 15_000,
})

api
  .on({
    onRetry:              ({ attempt, delayMs }) => logger.warn(`retry #${attempt} in ${delayMs}ms`),
    onCircuitStateChange: ({ from, to })         => metrics.increment(`circuit.${from}_${to}`),
    onBulkheadReject:     ()                     => metrics.increment('bulkhead.rejected'),
    onFallback:           ({ error })            => logger.error('fallback', error),
  })
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
  .bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
  .rateLimit({ permitLimit: 200, windowMs: 60_000 })
  .fallback(() => ({ items: [], degraded: true }))
  .dedup()

const { data } = await api.get<Item[]>('/items')
```

## Install

```bash
npm install super-http
```

::: info Requirements
Node.js ≥ 20 · TypeScript ≥ 5
:::

</div>

<style>
.home-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}
.home-content h2 {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 48px 0 16px;
}
</style>

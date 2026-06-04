---
layout: home

hero:
  name: "super-http"
  text: "Built for production, not just requests."
  tagline: Production-grade HTTP client for Node.js and TypeScript. Circuit breaker, bulkhead, rate limiter, jitter retry, fallback, metrics, and plugins — all in one fluent API.
  image:
    src: /logo.svg
    alt: super-http
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why super-http?
      link: /guide/why
    - theme: alt
      text: View on GitHub
      link: https://github.com/jhonesgoncalves/super-http-ts

features:
  - icon: 🔌
    title: Connection Pooling
    details: Shared http.Agent per base URL with TCP keep-alive. Zero handshake overhead. Prevents ECONNRESET from idle sockets. Auto-configured — no setup required.

  - icon: 🔄
    title: Jitter Retry
    details: Four pluggable strategies — fixed, exponential, full-jitter (AWS-recommended), and Retry-After-aware. Smart enough to never retry 4xx or open circuits.

  - icon: ⚡
    title: Circuit Breaker
    details: Three-state machine that fails fast when upstream is down. 84% faster than waiting for timeouts. Recovers automatically after probe succeeds.

  - icon: 🧱
    title: Bulkhead
    details: Semaphore isolation prevents one slow service from starving others. Bounded queue with configurable timeout. Stops resource exhaustion cascades.

  - icon: 🚦
    title: Rate Limiter
    details: Token-bucket with optional queuing. Retry-After header support means you never accidentally DDoS an API that tells you to back off.

  - icon: 🛡️
    title: Fallback
    details: Last line of defence — serve cached data, a default, or call a secondary source when all policies are exhausted. Never propagate avoidable errors.

  - icon: 👁️
    title: Observability
    details: Built-in metrics (req/success/failed/retries/p95/p99) via client.metrics(). Fire-and-forget hooks on every resilience event. Plugin system for Datadog, OTel, etc.

  - icon: 🎛️
    title: Presets & Policy Engine
    details: One-line setup with high-throughput, resilient-api, or low-latency presets. Per-request policy overrides for fine-grained control on individual endpoints.
---

<div class="home-content">

## Proven by benchmarks

Measured against a local Express server, Node.js 20 · [full results →](/guide/benchmarks)

| Scenario | Plain axios | super-http | Gain |
|---|---|---|---|
| Connection pool (200 req, 50c) | 2 222 req/s | **4 545 req/s** | **+105% throughput** |
| 50% flaky service (retry) | 51% success | **96% success** | **+45 pp** |
| Circuit breaker during outage | avg 84 ms/req | avg **14 ms/req** | **−83% latency** |
| Bulkhead isolation | p99 = 31 ms | p99 = **25 ms** | **−19% tail latency** |
| Rate limiter (429 avoidance) | 60% 429 errors | **0% 429 errors** | **zero errors** |
| vs. undici (no pool) | — | **+105%** | auto-pooling beats raw |

---

## The full resilience stack — one fluent API

```typescript
import { createClient, ExponentialJitterRetryStrategy, LoggerPlugin } from 'super-http'

const api = createClient({
  baseURL: 'https://api.example.com',
  preset: 'resilient-api',   // sensible defaults in one line
})

// Add-ons — all optional, all composable
api
  .use(LoggerPlugin({ prefix: '[checkout]' }))
  .on({
    onCircuitStateChange: ({ to, failures }) =>
      to === 'open' && alerts.send(`Circuit opened after ${failures} failures`),
  })

// Per-request policy for non-critical endpoints
const recs = await api.get('/recommendations', {
  policy: { timeout: 500, retry: false, fallback: () => [] },
})

// Built-in metrics — no extra setup
const { p99Latency, circuitBreakerTrips, retries } = api.metrics()
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

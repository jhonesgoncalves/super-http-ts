---
layout: home

hero:
  name: "super-http"
  text: "Resilient HTTP for Node.js"
  tagline: Circuit breaker, connection pooling, keep-alive and smart retry — production-ready out of the box.
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
    details: Shared http.Agent and https.Agent per base URL. Reuse TCP connections across requests — no handshake overhead, no stale-socket ECONNRESET.

  - icon: 🔄
    title: Smart Retry
    details: Automatically retries network errors (ECONNRESET, ETIMEDOUT, EPIPE…) and HTTP 5xx. Never retries 4xx — those are your fault, not the server's.

  - icon: ⚡
    title: Circuit Breaker
    details: Three-state machine (closed → open → half-open). Trips after N failures, recovers automatically. Fail fast instead of waiting for timeouts.

  - icon: 🔗
    title: Fluent API
    details: Chain .retry() and .circuitBreak() directly on the client. One line of config, full resilience.

  - icon: 🏭
    title: Singleton Factory
    details: HttpClientFactory returns the same instance per base URL. Connection pool is shared automatically — no duplicate agents.

  - icon: 🟦
    title: TypeScript First
    details: Full generic types on every method. JSDoc on every public API. Designed to make your IDE work for you.
---

<div class="home-content">

## Zero boilerplate, full resilience

```typescript
import { HttpClientFactory } from 'super-http'

const api = HttpClientFactory.create('https://api.example.com')

api
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500)

// Typed responses, pooled connections, auto-retry — just works
const { data } = await api.get<User[]>('/users')
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
  padding: 48px 24px 64px;
}

.home-content h2 {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 48px 0 16px;
}
</style>

# Changelog

All notable changes to **super-http** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2024-06-04

### Added

#### Bulkhead isolation (`BulkheadPolicy` inspired by Polly)
- `HttpClient.bulkhead(config)` — limits concurrent in-flight requests per client
- Bounded queue with optional `queueTimeoutMs` — rejects when queue overflows
- `onBulkheadReject` event hook

#### Rate limiter (token bucket)
- `HttpClient.rateLimit(config)` — fixed-window token bucket
- `queueRequests` mode: queue excess calls until next window
- `queueTimeoutMs` — reject queued calls after timeout
- `onRateLimitReject` event hook

#### Pluggable retry strategies
- `ExponentialJitterRetryStrategy(init, max, factor?)` — full jitter (AWS-recommended, prevents thundering herd)
- `ExponentialRetryStrategy(init, max, factor?)` — deterministic exponential backoff
- `RetryAfterStrategy()` — honours `Retry-After` response header (429/503), falls back to jitter
- `retry()` now accepts a `RetryStrategy` instance or a plain `number` (fully backwards-compatible)

#### Fallback / graceful degradation
- `HttpClient.fallback(fn)` — handler invoked after all policies exhausted
- `onFallback` event hook

#### Request deduplication
- `HttpClient.dedup()` — coalesces identical concurrent GET/HEAD calls into one network request

#### Observability hooks
- `HttpClient.on(events)` — register hooks for all resilience events
- `onRetry({ attempt, error, delayMs })`
- `onCircuitStateChange({ from, to, failures })`
- `onBulkheadReject({ active, queued })`
- `onFallback({ error })`
- `onRateLimitReject({ permitLimit, windowMs })`

#### Circuit breaker improvements
- Typed `state` property: `'closed' | 'open' | 'half-open'`
- Fires `onCircuitStateChange` on every state transition

### Changed
- `retry(n, delayMs)` signature extended to `retry(n, strategy | number, retryOn?)` — **backwards-compatible**

---

## [1.0.0] — 2024-06-04

### Added
- `HttpClient` with connection pooling via shared `http.Agent` / `https.Agent`
- TCP keep-alive enabled by default — prevents `ECONNRESET` on idle connections
- `PoolConfig` to tune `maxSockets`, `maxFreeSockets`, `keepAliveMsecs`, `timeout`
- Smart retry — retries network errors and 5xx, skips 4xx
- Optional `retryOn` list to retry only specific HTTP status codes
- Three-state circuit breaker (closed → open → half-open) with automatic recovery
- Convenience methods: `get`, `post`, `put`, `patch`, `delete`
- `HttpClientFactory` — singleton-per-baseURL factory with built-in pool reuse
- Full TypeScript types and JSDoc for every public API

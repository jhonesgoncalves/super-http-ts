# Changelog

All notable changes to **super-http** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-06-04

### Added
- `HttpClient` class with connection pooling via shared `http.Agent` / `https.Agent`
- TCP keep-alive enabled by default — prevents `ECONNRESET` on idle connections
- `PoolConfig` to tune `maxSockets`, `maxFreeSockets`, `keepAliveMsecs`, `timeout`
- Smart retry with back-off — retries network errors and 5xx, skips 4xx
- Optional `retryOn` list to retry only specific HTTP status codes
- Three-state circuit breaker (closed → open → half-open) with automatic recovery
- Convenience methods: `get`, `post`, `put`, `patch`, `delete`
- `HttpClientFactory` — singleton-per-baseURL factory with built-in pool reuse
- Full TypeScript types and JSDoc for every public API
- TypeDoc-generated API reference

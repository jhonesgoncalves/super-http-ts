# API Reference

Complete reference for all public APIs exported by `super-http`.

---

## Exports

```typescript
import {
  HttpClientFactory,    // singleton factory
  HttpClient,           // HTTP client class
  CircuitBreaker,       // circuit breaker class
  type PoolConfig,            // connection pool options
  type CircuitBreakerConfig,  // circuit breaker options
  type HttpClientRequestConfig, // axios request config
  type HttpClientResponse,    // axios response type
} from 'super-http'
```

---

## Quick navigation

| Export | Description |
|---|---|
| [`HttpClientFactory`](./http-client-factory) | Creates and caches `HttpClient` instances per base URL |
| [`HttpClient`](./http-client) | The HTTP client — methods, retry, circuit breaker |
| [`CircuitBreaker`](./circuit-breaker) | Three-state circuit breaker (closed/open/half-open) |
| [`PoolConfig`](./pool-config) | Connection pool configuration interface |

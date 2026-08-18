[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / MetricsSnapshot

# Interface: MetricsSnapshot

Defined in: [src/models/metrics.ts:8](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L8)

Runtime metrics snapshot for a single [HttpClient](../classes/HttpClient.md) instance.

Returned by [client.metrics()](../classes/HttpClient.md#metrics).
All counters accumulate since the client was created (or since the last
[client.resetMetrics()](../classes/HttpClient.md#resetmetrics) call).

## Properties

### avgLatency

> **avgLatency**: `number`

Defined in: [src/models/metrics.ts:26](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L26)

Average response latency in ms across **all** successful requests.

***

### bulkheadRejects

> **bulkheadRejects**: `number`

Defined in: [src/models/metrics.ts:20](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L20)

Requests rejected by the bulkhead (queue full).

***

### circuitBreakerTrips

> **circuitBreakerTrips**: `number`

Defined in: [src/models/metrics.ts:18](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L18)

Number of times the circuit breaker transitioned to `open`.

***

### failed

> **failed**: `number`

Defined in: [src/models/metrics.ts:14](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L14)

Requests that ultimately failed (after all retry attempts).

***

### fallbacks

> **fallbacks**: `number`

Defined in: [src/models/metrics.ts:24](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L24)

Number of times the fallback handler was invoked.

***

### p50Latency

> **p50Latency**: `number`

Defined in: [src/models/metrics.ts:34](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L34)

Median (p50) response latency in ms.

Percentiles are computed over a rolling window of the most recent
successful requests (the most recent 2048), not the full history —
so they track current behaviour rather than the process lifetime.

***

### p95Latency

> **p95Latency**: `number`

Defined in: [src/models/metrics.ts:36](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L36)

95th-percentile response latency in ms, over the recent-request window.

***

### p99Latency

> **p99Latency**: `number`

Defined in: [src/models/metrics.ts:38](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L38)

99th-percentile response latency in ms, over the recent-request window.

***

### rateLimitRejects

> **rateLimitRejects**: `number`

Defined in: [src/models/metrics.ts:22](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L22)

Requests rejected by the rate limiter.

***

### requests

> **requests**: `number`

Defined in: [src/models/metrics.ts:10](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L10)

Total logical requests dispatched (retried attempts are counted in `retries`).

***

### retries

> **retries**: `number`

Defined in: [src/models/metrics.ts:16](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L16)

Number of retry attempts fired across all requests.

***

### success

> **success**: `number`

Defined in: [src/models/metrics.ts:12](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L12)

Requests that completed with a 2xx / non-error response.

***

### uptime

> **uptime**: `number`

Defined in: [src/models/metrics.ts:40](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/metrics.ts#L40)

Milliseconds since the client was created (or since the last reset).

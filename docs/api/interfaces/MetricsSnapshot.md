[**super-http v2.1.1**](../README.md)

***

[super-http](../README.md) / MetricsSnapshot

# Interface: MetricsSnapshot

Defined in: [src/models/metrics.ts:8](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L8)

Runtime metrics snapshot for a single [HttpClient](../classes/HttpClient.md) instance.

Returned by [client.metrics()](../classes/HttpClient.md#metrics).
All counters accumulate since the client was created (or since the last
[client.resetMetrics()](../classes/HttpClient.md#resetmetrics) call).

## Properties

### attemptErrors

> **attemptErrors**: `number`

Defined in: [src/models/metrics.ts:10](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L10)

***

### avgFailedLatency

> **avgFailedLatency**: `number`

Defined in: [src/models/metrics.ts:14](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L14)

***

### avgLatency

> **avgLatency**: `number`

Defined in: [src/models/metrics.ts:32](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L32)

Average response latency in ms across **all** successful requests.

***

### bulkheadRejects

> **bulkheadRejects**: `number`

Defined in: [src/models/metrics.ts:26](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L26)

Requests rejected by the bulkhead (queue full).

***

### circuitBreakerTrips

> **circuitBreakerTrips**: `number`

Defined in: [src/models/metrics.ts:24](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L24)

Number of times the circuit breaker transitioned to `open`.

***

### failed

> **failed**: `number`

Defined in: [src/models/metrics.ts:20](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L20)

Requests that ultimately failed (after all retry attempts).

***

### fallbacks

> **fallbacks**: `number`

Defined in: [src/models/metrics.ts:30](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L30)

Number of times the fallback handler was invoked.

***

### newSocketResets

> **newSocketResets**: `number`

Defined in: [src/models/metrics.ts:12](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L12)

***

### p50Latency

> **p50Latency**: `number`

Defined in: [src/models/metrics.ts:40](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L40)

Median (p50) response latency in ms.

Percentiles are computed over a rolling window of the most recent
successful requests (the most recent 2048), not the full history —
so they track current behaviour rather than the process lifetime.

***

### p95Latency

> **p95Latency**: `number`

Defined in: [src/models/metrics.ts:42](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L42)

95th-percentile response latency in ms, over the recent-request window.

***

### p99Latency

> **p99Latency**: `number`

Defined in: [src/models/metrics.ts:44](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L44)

99th-percentile response latency in ms, over the recent-request window.

***

### rateLimitRejects

> **rateLimitRejects**: `number`

Defined in: [src/models/metrics.ts:28](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L28)

Requests rejected by the rate limiter.

***

### recovered

> **recovered**: `number`

Defined in: [src/models/metrics.ts:9](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L9)

***

### requests

> **requests**: `number`

Defined in: [src/models/metrics.ts:16](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L16)

Total logical requests dispatched (retried attempts are counted in `retries`).

***

### retries

> **retries**: `number`

Defined in: [src/models/metrics.ts:22](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L22)

Number of retry attempts fired across all requests.

***

### reusedSocketResets

> **reusedSocketResets**: `number`

Defined in: [src/models/metrics.ts:11](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L11)

***

### success

> **success**: `number`

Defined in: [src/models/metrics.ts:18](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L18)

Requests that completed with a 2xx / non-error response.

***

### unknownSocketResets

> **unknownSocketResets**: `number`

Defined in: [src/models/metrics.ts:13](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L13)

***

### uptime

> **uptime**: `number`

Defined in: [src/models/metrics.ts:46](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/metrics.ts#L46)

Milliseconds since the client was created (or since the last reset).

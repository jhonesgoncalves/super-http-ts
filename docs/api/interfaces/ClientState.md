[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / ClientState

# Interface: ClientState

Defined in: [src/http-client/http.client.ts:107](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L107)

Live state of a client's resilience components — what is true *now*, as
opposed to the cumulative counters in [MetricsSnapshot](MetricsSnapshot.md).

`circuitBreakerTrips` tells you the circuit opened at some point; it cannot
answer "is it open right now?", which is the question a dashboard or an alert
actually asks.

## Properties

### bulkhead?

> `optional` **bulkhead?**: `object`

Defined in: [src/http-client/http.client.ts:113](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L113)

In-flight and queued counts, if a bulkhead is configured.

#### active

> **active**: `number`

#### queued

> **queued**: `number`

***

### circuit?

> `optional` **circuit?**: `object`

Defined in: [src/http-client/http.client.ts:109](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L109)

Client-level circuit, if one is configured.

#### open

> **open**: `boolean`

#### state

> **state**: [`CircuitState`](../type-aliases/CircuitState.md)

***

### dedup?

> `optional` **dedup?**: `object`

Defined in: [src/http-client/http.client.ts:117](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L117)

Number of in-flight coalesced requests, if dedup is enabled.

#### inFlight

> **inFlight**: `number`

***

### policyCircuits

> **policyCircuits**: `Record`\<`string`, \{ `open`: `boolean`; `state`: [`CircuitState`](../type-aliases/CircuitState.md); \}\>

Defined in: [src/http-client/http.client.ts:111](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L111)

Circuits created for per-request policy overrides, keyed by config.

***

### rateLimit?

> `optional` **rateLimit?**: `object`

Defined in: [src/http-client/http.client.ts:115](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L115)

Tokens left in the current window and queue depth, if configured.

#### available

> **available**: `number`

#### queued

> **queued**: `number`

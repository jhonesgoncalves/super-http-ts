[**super-http v2.1.0**](../README.md)

***

[super-http](../README.md) / ClientState

# Interface: ClientState

Defined in: [src/http-client/http.client.ts:125](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L125)

Live state of a client's resilience components — what is true *now*, as
opposed to the cumulative counters in [MetricsSnapshot](MetricsSnapshot.md).

`circuitBreakerTrips` tells you the circuit opened at some point; it cannot
answer "is it open right now?", which is the question a dashboard or an alert
actually asks.

## Properties

### bulkhead?

> `optional` **bulkhead?**: `object`

Defined in: [src/http-client/http.client.ts:136](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L136)

In-flight and queued counts, if a bulkhead is configured.

#### active

> **active**: `number`

#### queued

> **queued**: `number`

***

### circuit?

> `optional` **circuit?**: `object`

Defined in: [src/http-client/http.client.ts:132](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L132)

Client-level circuit, if one is configured.

#### open

> **open**: `boolean`

#### state

> **state**: [`CircuitState`](../type-aliases/CircuitState.md)

***

### dedup?

> `optional` **dedup?**: `object`

Defined in: [src/http-client/http.client.ts:140](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L140)

Number of in-flight coalesced requests, if dedup is enabled.

#### inFlight

> **inFlight**: `number`

***

### policyCircuits

> **policyCircuits**: `Record`\<`string`, \{ `open`: `boolean`; `state`: [`CircuitState`](../type-aliases/CircuitState.md); \}\>

Defined in: [src/http-client/http.client.ts:134](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L134)

Circuits created for per-request policy overrides, keyed by config.

***

### pool

> **pool**: `object`

Defined in: [src/http-client/http.client.ts:127](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L127)

Pool counts per protocol, for this client/process.

#### http

> **http**: `object`

##### http.active

> **active**: `number`

##### http.idle

> **idle**: `number`

##### http.queued

> **queued**: `number`

#### https

> **https**: `object`

##### https.active

> **active**: `number`

##### https.idle

> **idle**: `number`

##### https.queued

> **queued**: `number`

***

### rateLimit?

> `optional` **rateLimit?**: `object`

Defined in: [src/http-client/http.client.ts:138](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L138)

Tokens left in the current window and queue depth, if configured.

#### available

> **available**: `number`

#### queued

> **queued**: `number`

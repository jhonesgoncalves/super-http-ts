[**super-http v2.1.0**](../README.md)

***

[super-http](../README.md) / BulkheadRejectEvent

# Interface: BulkheadRejectEvent

Defined in: [src/models/resilience.events.ts:60](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L60)

Context passed to `onBulkheadReject`.

## Properties

### active

> **active**: `number`

Defined in: [src/models/resilience.events.ts:62](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L62)

Number of currently active requests at rejection time.

***

### queued

> **queued**: `number`

Defined in: [src/models/resilience.events.ts:64](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L64)

Number of requests waiting in the queue at rejection time.

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:66](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L66)

Correlation id of the request this event belongs to.

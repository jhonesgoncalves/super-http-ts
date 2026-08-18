[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / BulkheadRejectEvent

# Interface: BulkheadRejectEvent

Defined in: [src/models/resilience.events.ts:39](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L39)

Context passed to `onBulkheadReject`.

## Properties

### active

> **active**: `number`

Defined in: [src/models/resilience.events.ts:41](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L41)

Number of currently active requests at rejection time.

***

### queued

> **queued**: `number`

Defined in: [src/models/resilience.events.ts:43](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L43)

Number of requests waiting in the queue at rejection time.

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:45](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L45)

Correlation id of the request this event belongs to.

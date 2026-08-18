[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RateLimitRejectEvent

# Interface: RateLimitRejectEvent

Defined in: [src/models/resilience.events.ts:61](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L61)

Context passed to `onRateLimitReject`.

## Properties

### permitLimit

> **permitLimit**: `number`

Defined in: [src/models/resilience.events.ts:63](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L63)

Configured request limit for the window.

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:67](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L67)

Correlation id of the request this event belongs to.

***

### windowMs

> **windowMs**: `number`

Defined in: [src/models/resilience.events.ts:65](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L65)

Window size in ms.

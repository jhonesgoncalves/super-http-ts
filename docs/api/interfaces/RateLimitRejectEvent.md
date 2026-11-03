[**super-http v3.0.0**](../README.md)

***

[super-http](../README.md) / RateLimitRejectEvent

# Interface: RateLimitRejectEvent

Defined in: [src/models/resilience.events.ts:82](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/models/resilience.events.ts#L82)

Context passed to `onRateLimitReject`.

## Properties

### permitLimit

> **permitLimit**: `number`

Defined in: [src/models/resilience.events.ts:84](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/models/resilience.events.ts#L84)

Configured request limit for the window.

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:88](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/models/resilience.events.ts#L88)

Correlation id of the request this event belongs to.

***

### windowMs

> **windowMs**: `number`

Defined in: [src/models/resilience.events.ts:86](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/models/resilience.events.ts#L86)

Window size in ms.

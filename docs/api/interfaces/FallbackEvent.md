[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / FallbackEvent

# Interface: FallbackEvent

Defined in: [src/models/resilience.events.ts:51](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L51)

Context passed to `onFallback`.

## Properties

### error

> **error**: `unknown`

Defined in: [src/models/resilience.events.ts:53](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L53)

The original error that triggered the fallback.

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:55](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L55)

Correlation id of the request this event belongs to.

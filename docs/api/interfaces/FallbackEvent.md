[**super-http v2.1.2**](../README.md)

***

[super-http](../README.md) / FallbackEvent

# Interface: FallbackEvent

Defined in: [src/models/resilience.events.ts:72](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/models/resilience.events.ts#L72)

Context passed to `onFallback`.

## Properties

### error

> **error**: `unknown`

Defined in: [src/models/resilience.events.ts:74](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/models/resilience.events.ts#L74)

The original error that triggered the fallback.

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:76](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/models/resilience.events.ts#L76)

Correlation id of the request this event belongs to.

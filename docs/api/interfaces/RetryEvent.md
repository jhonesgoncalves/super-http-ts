[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RetryEvent

# Interface: RetryEvent

Defined in: [src/models/resilience.events.ts:6](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L6)

Context passed to the `onRetry` hook.

## Properties

### attempt

> **attempt**: `number`

Defined in: [src/models/resilience.events.ts:8](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L8)

Zero-based attempt index (0 = first retry).

***

### delayMs

> **delayMs**: `number`

Defined in: [src/models/resilience.events.ts:12](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L12)

Delay that will be waited before the next attempt (ms).

***

### error

> **error**: `unknown`

Defined in: [src/models/resilience.events.ts:10](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L10)

The error that triggered the retry.

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:20](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L20)

Correlation id of the request this retry belongs to.

Without it these events are anonymous: a retry log line cannot be tied back
to the request that produced it, which is exactly what you need during an
incident.

[**super-http v2.1.1**](../README.md)

***

[super-http](../README.md) / RetryEvent

# Interface: RetryEvent

Defined in: [src/models/resilience.events.ts:25](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L25)

Context passed to the `onRetry` hook.

## Properties

### attempt

> **attempt**: `number`

Defined in: [src/models/resilience.events.ts:29](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L29)

Zero-based attempt index (0 = first retry).

***

### delayMs

> **delayMs**: `number`

Defined in: [src/models/resilience.events.ts:33](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L33)

Delay that will be waited before the next attempt (ms).

***

### error

> **error**: `unknown`

Defined in: [src/models/resilience.events.ts:31](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L31)

The error that triggered the retry.

***

### remainingDeadlineMs?

> `optional` **remainingDeadlineMs?**: `number`

Defined in: [src/models/resilience.events.ts:27](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L27)

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:41](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L41)

Correlation id of the request this retry belongs to.

Without it these events are anonymous: a retry log line cannot be tied back
to the request that produced it, which is exactly what you need during an
incident.

***

### reusedSocket?

> `optional` **reusedSocket?**: `boolean`

Defined in: [src/models/resilience.events.ts:26](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L26)

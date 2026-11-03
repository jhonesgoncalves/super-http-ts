[**super-http v2.1.0**](../README.md)

***

[super-http](../README.md) / AttemptErrorEvent

# Interface: AttemptErrorEvent

Defined in: [src/models/resilience.events.ts:4](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L4)

One failed transport attempt, which may still be recovered.

## Properties

### attempt

> **attempt**: `number`

Defined in: [src/models/resilience.events.ts:11](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L11)

One-based transport attempt number.

***

### code?

> `optional` **code?**: `string`

Defined in: [src/models/resilience.events.ts:6](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L6)

***

### elapsedMs

> **elapsedMs**: `number`

Defined in: [src/models/resilience.events.ts:12](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L12)

***

### error

> **error**: `unknown`

Defined in: [src/models/resilience.events.ts:5](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L5)

***

### remainingDeadlineMs

> **remainingDeadlineMs**: `number`

Defined in: [src/models/resilience.events.ts:13](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L13)

***

### requestId?

> `optional` **requestId?**: `string`

Defined in: [src/models/resilience.events.ts:9](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L9)

***

### reusedSocket?

> `optional` **reusedSocket?**: `boolean`

Defined in: [src/models/resilience.events.ts:8](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L8)

***

### status?

> `optional` **status?**: `number`

Defined in: [src/models/resilience.events.ts:7](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/models/resilience.events.ts#L7)

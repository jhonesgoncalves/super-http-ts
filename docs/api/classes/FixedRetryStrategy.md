[**super-http v2.1.1**](../README.md)

***

[super-http](../README.md) / FixedRetryStrategy

# Class: FixedRetryStrategy

Defined in: [src/models/retry.strategy.ts:31](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/retry.strategy.ts#L31)

Fixed-delay retry strategy — every retry waits the same `delayMs`.

Simple and predictable but can cause thundering-herd under mass failures.
Prefer [ExponentialJitterRetryStrategy](ExponentialJitterRetryStrategy.md) for distributed systems.

## Implements

- [`RetryStrategy`](../interfaces/RetryStrategy.md)

## Constructors

### Constructor

> **new FixedRetryStrategy**(`delayMs`): `FixedRetryStrategy`

Defined in: [src/models/retry.strategy.ts:32](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/retry.strategy.ts#L32)

#### Parameters

##### delayMs

`number`

#### Returns

`FixedRetryStrategy`

## Methods

### computeDelay()

> **computeDelay**(): `number`

Defined in: [src/models/retry.strategy.ts:37](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/retry.strategy.ts#L37)

Computes the delay (ms) before attempt number `attempt` (0-based).

#### Returns

`number`

#### Implementation of

[`RetryStrategy`](../interfaces/RetryStrategy.md).[`computeDelay`](../interfaces/RetryStrategy.md#computedelay)

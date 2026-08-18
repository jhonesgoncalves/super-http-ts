[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / ExponentialRetryStrategy

# Class: ExponentialRetryStrategy

Defined in: [src/models/retry.strategy.ts:49](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L49)

Exponential back-off retry strategy.

Delay grows as `initialDelayMs × factor^attempt`, capped at `maxDelayMs`.
All retries from all clients attempt at the same moments — use
[ExponentialJitterRetryStrategy](ExponentialJitterRetryStrategy.md) to spread them out.

## Implements

- [`RetryStrategy`](../interfaces/RetryStrategy.md)

## Constructors

### Constructor

> **new ExponentialRetryStrategy**(`initialDelayMs`, `maxDelayMs?`, `factor?`): `ExponentialRetryStrategy`

Defined in: [src/models/retry.strategy.ts:50](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L50)

#### Parameters

##### initialDelayMs

`number`

##### maxDelayMs?

`number` = `30_000`

##### factor?

`number` = `2`

#### Returns

`ExponentialRetryStrategy`

## Methods

### computeDelay()

> **computeDelay**(`attempt`): `number`

Defined in: [src/models/retry.strategy.ts:60](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L60)

Computes the delay (ms) before attempt number `attempt` (0-based).

#### Parameters

##### attempt

`number`

Zero-based retry attempt index.

#### Returns

`number`

#### Implementation of

[`RetryStrategy`](../interfaces/RetryStrategy.md).[`computeDelay`](../interfaces/RetryStrategy.md#computedelay)

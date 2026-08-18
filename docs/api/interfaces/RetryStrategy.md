[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RetryStrategy

# Interface: RetryStrategy

Defined in: [src/models/retry.strategy.ts:16](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L16)

A pluggable strategy for computing the delay before a retry attempt.

Three built-in strategies are provided:
- [FixedRetryStrategy](../classes/FixedRetryStrategy.md) — constant delay (original behaviour)
- [ExponentialRetryStrategy](../classes/ExponentialRetryStrategy.md) — delay doubles with each attempt
- [ExponentialJitterRetryStrategy](../classes/ExponentialJitterRetryStrategy.md) — exponential with randomised jitter (recommended)

## Example

```ts
client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
```

## Methods

### computeDelay()

> **computeDelay**(`attempt`, `error?`): `number`

Defined in: [src/models/retry.strategy.ts:22](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L22)

Computes the delay (ms) before attempt number `attempt` (0-based).

#### Parameters

##### attempt

`number`

Zero-based retry attempt index.

##### error?

`unknown`

The error that triggered the retry.

#### Returns

`number`

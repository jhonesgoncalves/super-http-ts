[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / ExponentialJitterRetryStrategy

# Class: ExponentialJitterRetryStrategy

Defined in: [src/models/retry.strategy.ts:80](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L80)

Exponential back-off with **full jitter** (AWS-recommended).

Delay is a random value in `[0, min(maxDelayMs, initialDelayMs × factor^attempt)]`.
This distributes retries across time and prevents the thundering-herd problem
in distributed systems where many clients fail simultaneously.

## See

https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

## Example

```ts
// Retry up to 4 times: 0–100 ms, 0–200 ms, 0–400 ms, 0–800 ms
client.retry(4, new ExponentialJitterRetryStrategy(100, 10_000))
```

## Implements

- [`RetryStrategy`](../interfaces/RetryStrategy.md)

## Constructors

### Constructor

> **new ExponentialJitterRetryStrategy**(`initialDelayMs`, `maxDelayMs?`, `factor?`): `ExponentialJitterRetryStrategy`

Defined in: [src/models/retry.strategy.ts:81](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L81)

#### Parameters

##### initialDelayMs

`number`

##### maxDelayMs?

`number` = `30_000`

##### factor?

`number` = `2`

#### Returns

`ExponentialJitterRetryStrategy`

## Methods

### computeDelay()

> **computeDelay**(`attempt`): `number`

Defined in: [src/models/retry.strategy.ts:91](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L91)

Computes the delay (ms) before attempt number `attempt` (0-based).

#### Parameters

##### attempt

`number`

Zero-based retry attempt index.

#### Returns

`number`

#### Implementation of

[`RetryStrategy`](../interfaces/RetryStrategy.md).[`computeDelay`](../interfaces/RetryStrategy.md#computedelay)

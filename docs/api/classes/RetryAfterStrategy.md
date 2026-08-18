[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RetryAfterStrategy

# Class: RetryAfterStrategy

Defined in: [src/models/retry.strategy.ts:113](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L113)

Retry strategy that honours the server's `Retry-After` response header
(sent on HTTP 429 and 503), with an exponential-jitter fallback.

The `Retry-After` header may be:
- A delta-seconds value: `"30"` → wait 30 s
- An HTTP-date value: `"Wed, 21 Oct 2025 07:28:00 GMT"`

The parsed delay is capped at `maxDelayMs` — an upstream asking for an hour
must not hold the caller for an hour.

## Example

```ts
client.retry(5, new RetryAfterStrategy(200, 60_000))
```

## Implements

- [`RetryStrategy`](../interfaces/RetryStrategy.md)

## Constructors

### Constructor

> **new RetryAfterStrategy**(`initialDelayMs?`, `maxDelayMs?`, `factor?`): `RetryAfterStrategy`

Defined in: [src/models/retry.strategy.ts:117](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L117)

#### Parameters

##### initialDelayMs?

`number` = `200`

##### maxDelayMs?

`number` = `60_000`

##### factor?

`number` = `2`

#### Returns

`RetryAfterStrategy`

## Methods

### computeDelay()

> **computeDelay**(`attempt`, `error?`): `number`

Defined in: [src/models/retry.strategy.ts:122](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/retry.strategy.ts#L122)

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

#### Implementation of

[`RetryStrategy`](../interfaces/RetryStrategy.md).[`computeDelay`](../interfaces/RetryStrategy.md#computedelay)

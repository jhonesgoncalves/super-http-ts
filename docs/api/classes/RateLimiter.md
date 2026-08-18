[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RateLimiter

# Class: RateLimiter

Defined in: [src/rate-limiter/rate-limiter.ts:72](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L72)

Fixed-window token-bucket rate limiter.

Tokens refill to `permitLimit` at the start of each window. When tokens
are exhausted, requests either queue (if `queueRequests` is `true`) or are
rejected immediately.

## Example

```ts
const rl = new RateLimiter({ permitLimit: 100, windowMs: 60_000 });
await rl.acquire(); // blocks until a token is available
```

## Constructors

### Constructor

> **new RateLimiter**(`config`, `events?`): `RateLimiter`

Defined in: [src/rate-limiter/rate-limiter.ts:92](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L92)

#### Parameters

##### config

[`RateLimitConfig`](../interfaces/RateLimitConfig.md)

##### events?

`Pick`\<[`ResilienceEvents`](../interfaces/ResilienceEvents.md), `"onRateLimitReject"`\>

#### Returns

`RateLimiter`

## Properties

### DEFAULT\_MAX\_QUEUE

> `readonly` `static` **DEFAULT\_MAX\_QUEUE**: `1000` = `1000`

Defined in: [src/rate-limiter/rate-limiter.ts:76](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L76)

Wait-queue ceiling applied when `maxQueue` is omitted.

***

### DEFAULT\_QUEUE\_TIMEOUT\_MS

> `readonly` `static` **DEFAULT\_QUEUE\_TIMEOUT\_MS**: `10000` = `10_000`

Defined in: [src/rate-limiter/rate-limiter.ts:74](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L74)

Queue wait applied when `queueTimeoutMs` is omitted.

## Accessors

### available

#### Get Signature

> **get** **available**(): `number`

Defined in: [src/rate-limiter/rate-limiter.ts:185](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L185)

Number of tokens remaining in the current window.

##### Returns

`number`

***

### queuedCount

#### Get Signature

> **get** **queuedCount**(): `number`

Defined in: [src/rate-limiter/rate-limiter.ts:191](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L191)

Number of requests currently waiting for a token.

##### Returns

`number`

## Methods

### acquire()

> **acquire**(`opts?`): `Promise`\<`void`\>

Defined in: [src/rate-limiter/rate-limiter.ts:120](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L120)

Acquires a token, blocking if `queueRequests` is enabled.

#### Parameters

##### opts?

###### maxWaitMs?

`number`

Ceiling from the caller's remaining total budget.
  Combined with `queueTimeoutMs`; the smaller of the two wins.

###### signal?

`AbortSignal`

Abort the wait when this fires.

#### Returns

`Promise`\<`void`\>

#### Throws

`Error('Rate limit exceeded')` when no token is available and
  `queueRequests` is `false`.

#### Throws

`Error('Rate limit queue full')` when the wait queue is at `maxQueue`.

#### Throws

`Error('Rate limit queue timeout')` when a queued request waits
  longer than the effective timeout.

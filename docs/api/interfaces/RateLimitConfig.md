[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RateLimitConfig

# Interface: RateLimitConfig

Defined in: [src/rate-limiter/rate-limiter.ts:14](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L14)

Configuration for the [RateLimiter](../classes/RateLimiter.md) (fixed-window token bucket).

## Example

```ts
// Allow 100 requests per minute, queue excess with 5 s max wait
client.rateLimit({ permitLimit: 100, windowMs: 60_000, queueRequests: true, queueTimeoutMs: 5_000 })
```

## Properties

### maxQueue?

> `optional` **maxQueue?**: `number`

Defined in: [src/rate-limiter/rate-limiter.ts:56](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L56)

Max number of requests allowed to wait for a token. Beyond this, callers are
rejected immediately with `Error('Rate limit queue full')`.

An unbounded wait queue grows without limit while a window is saturated — a
memory leak plus latency nobody can put a number on.

#### Default Value

```ts
1000
```

***

### permitLimit

> **permitLimit**: `number`

Defined in: [src/rate-limiter/rate-limiter.ts:18](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L18)

Maximum number of requests allowed in each `windowMs` period.

***

### queueRequests?

> `optional` **queueRequests?**: `boolean`

Defined in: [src/rate-limiter/rate-limiter.ts:32](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L32)

When `true`, requests that exceed the limit are queued until the next
window opens (or until `queueTimeoutMs` elapses).
When `false` (default), excess requests are rejected immediately.

#### Default Value

```ts
false
```

***

### queueTimeoutMs?

> `optional` **queueTimeoutMs?**: `number`

Defined in: [src/rate-limiter/rate-limiter.ts:45](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L45)

Max time (ms) a queued request will wait for a token before being
rejected with `Error('Rate limit queue timeout')`.
Only relevant when `queueRequests` is `true`.

Defaults to [RateLimiter.DEFAULT\_QUEUE\_TIMEOUT\_MS](../classes/RateLimiter.md#default_queue_timeout_ms). Pass `Infinity` to
wait forever — that blocks the caller indefinitely, so it has to be asked
for deliberately rather than being what you get by omission.

#### Default Value

```ts
10000
```

***

### windowMs

> **windowMs**: `number`

Defined in: [src/rate-limiter/rate-limiter.ts:24](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/rate-limiter/rate-limiter.ts#L24)

Length of the rate-limit window in milliseconds.

#### Example

```ts
60_000  // 1 minute
```

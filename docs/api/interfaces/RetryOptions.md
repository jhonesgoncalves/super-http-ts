[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RetryOptions

# Interface: RetryOptions

Defined in: [src/http-client/http.client.ts:28](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L28)

Extra options for [HttpClient.retry](../classes/HttpClient.md#retry).

## Properties

### retryNonIdempotent?

> `optional` **retryNonIdempotent?**: `boolean`

Defined in: [src/http-client/http.client.ts:44](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L44)

Retry non-idempotent methods (`POST`, `PATCH`) even on errors where the
request may already have been applied upstream.

Off by default: a timed-out `POST /payments` that gets re-sent can charge
twice. Turn this on only when the endpoint is protected by an idempotency
key.

#### Default Value

```ts
false
```

***

### retryOn?

> `optional` **retryOn?**: `number`[]

Defined in: [src/http-client/http.client.ts:33](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L33)

Additional HTTP status codes to retry on, **on top of** the network-error
rules — not instead of them.

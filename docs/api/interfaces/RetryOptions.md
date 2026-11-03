[**super-http v2.1.1**](../README.md)

***

[super-http](../README.md) / RetryOptions

# Interface: RetryOptions

Defined in: [src/http-client/http.client.ts:34](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/http-client/http.client.ts#L34)

Extra options for [HttpClient.retry](../classes/HttpClient.md#retry).

## Properties

### recoverReusedSocket?

> `optional` **recoverReusedSocket?**: `boolean`

Defined in: [src/http-client/http.client.ts:54](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/http-client/http.client.ts#L54)

Use one existing retry to recover a reused-socket reset on a fresh connection.
The eligible first reset is deferred from breaker health counting. Default true.

***

### retryNonIdempotent?

> `optional` **retryNonIdempotent?**: `boolean`

Defined in: [src/http-client/http.client.ts:50](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/http-client/http.client.ts#L50)

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

Defined in: [src/http-client/http.client.ts:39](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/http-client/http.client.ts#L39)

Additional HTTP status codes to retry on, **on top of** the network-error
rules — not instead of them.

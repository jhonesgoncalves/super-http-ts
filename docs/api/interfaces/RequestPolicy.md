[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RequestPolicy

# Interface: RequestPolicy

Defined in: [src/http-client/http.client.ts:64](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L64)

Per-request policy that overrides the client-level resilience config
for a single request.

## Example

```ts
// Critical endpoint — tighter timeout and fewer retries
await client.get('/payments', {
  policy: { timeout: 1000, retry: { attempts: 1, delayMs: 100 } }
})

// Non-critical — silent fallback
await client.get('/recommendations', {
  policy: { fallback: () => [] }
})
```

## Properties

### circuitBreaker?

> `optional` **circuitBreaker?**: `false` \| `Partial`\<[`CircuitBreakerConfig`](CircuitBreakerConfig.md)\>

Defined in: [src/http-client/http.client.ts:76](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L76)

Override circuit breaker for this request only.
Pass `false` to bypass the circuit breaker even if one is configured.

***

### deadlineMs?

> `optional` **deadlineMs?**: `number`

Defined in: [src/http-client/http.client.ts:96](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L96)

Upper bound (ms) on the **total** time this call may take: rate-limit wait
plus bulkhead wait plus every attempt plus every backoff.

`timeout` bounds one attempt; this bounds the call. Without it a request
with retries and queueing has no limit the caller can state.

***

### fallback?

> `optional` **fallback?**: (`error`) => `unknown`

Defined in: [src/http-client/http.client.ts:81](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L81)

Override fallback for this request only.
If set, this replaces the client-level fallback (if any).

#### Parameters

##### error

`unknown`

#### Returns

`unknown`

***

### retry?

> `optional` **retry?**: `false` \| \{ `attempts`: `number`; `delayMs?`: `number`; `retryNonIdempotent?`: `boolean`; `retryOn?`: `number`[]; \}

Defined in: [src/http-client/http.client.ts:71](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L71)

Override retry config for this request only.
Pass `false` to disable retry even if the client has one configured.

***

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [src/http-client/http.client.ts:87](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L87)

Cancels the whole call — queue waits, retry backoff and the in-flight
request alike, not just the socket.

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: [src/http-client/http.client.ts:66](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L66)

Override the request timeout (ms) for this request only.

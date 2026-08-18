[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / ResilienceEvents

# Interface: ResilienceEvents

Defined in: [src/models/resilience.events.ts:87](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L87)

Observability and lifecycle hooks.

All handlers are **fire-and-forget** — errors thrown inside them are silently
swallowed and never affect the request path.

## Example

```ts
client.on({
  onRequest:  (cfg)           => logger.debug(`→ ${cfg.method} ${cfg.url}`),
  onResponse: (res)           => logger.debug(`← ${res.status}`),
  onError:    (err)           => logger.error('request failed', err),
  onRetry:    ({ attempt })   => metrics.increment('retry', { attempt }),
  onCircuitStateChange: ({ from, to }) => metrics.gauge('circuit', to),
})
```

## Properties

### onBulkheadReject?

> `optional` **onBulkheadReject?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:117](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L117)

Fired when a request is rejected by the bulkhead.

#### Parameters

##### event

[`BulkheadRejectEvent`](BulkheadRejectEvent.md)

#### Returns

`void`

***

### onCircuitStateChange?

> `optional` **onCircuitStateChange?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:114](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L114)

Fired whenever the circuit breaker transitions between states.

#### Parameters

##### event

[`CircuitStateChangeEvent`](CircuitStateChangeEvent.md)

#### Returns

`void`

***

### onError?

> `optional` **onError?**: (`error`) => `void`

Defined in: [src/models/resilience.events.ts:106](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L106)

Fired when a request ultimately fails (after retries, if configured).
Not fired for retried errors that eventually succeed.

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### onFallback?

> `optional` **onFallback?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:120](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L120)

Fired when the fallback handler is invoked.

#### Parameters

##### event

[`FallbackEvent`](FallbackEvent.md)

#### Returns

`void`

***

### onRateLimitReject?

> `optional` **onRateLimitReject?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:123](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L123)

Fired when a request is rejected by the rate limiter.

#### Parameters

##### event

[`RateLimitRejectEvent`](RateLimitRejectEvent.md)

#### Returns

`void`

***

### onRequest?

> `optional` **onRequest?**: (`config`) => `void`

Defined in: [src/models/resilience.events.ts:94](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L94)

Fired just before every HTTP request is sent (after all policies are applied).
Use for logging, tracing, or header injection.

#### Parameters

##### config

`AxiosRequestConfig`

#### Returns

`void`

***

### onResponse?

> `optional` **onResponse?**: (`response`) => `void`

Defined in: [src/models/resilience.events.ts:100](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L100)

Fired when a successful response is received.
Note: called before the response reaches the caller.

#### Parameters

##### response

`AxiosResponse`

#### Returns

`void`

***

### onRetry?

> `optional` **onRetry?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:111](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L111)

Fired before each retry attempt.

#### Parameters

##### event

[`RetryEvent`](RetryEvent.md)

#### Returns

`void`

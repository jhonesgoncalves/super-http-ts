[**super-http v2.1.1**](../README.md)

***

[super-http](../README.md) / ResilienceEvents

# Interface: ResilienceEvents

Defined in: [src/models/resilience.events.ts:108](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L108)

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

### onAttemptError?

> `optional` **onAttemptError?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:129](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L129)

A transport attempt failed; the logical operation may still recover.

#### Parameters

##### event

[`AttemptErrorEvent`](AttemptErrorEvent.md)

#### Returns

`void`

***

### onBulkheadReject?

> `optional` **onBulkheadReject?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:142](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L142)

Fired when a request is rejected by the bulkhead.

#### Parameters

##### event

[`BulkheadRejectEvent`](BulkheadRejectEvent.md)

#### Returns

`void`

***

### onCircuitStateChange?

> `optional` **onCircuitStateChange?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:139](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L139)

Fired whenever the circuit breaker transitions between states.

#### Parameters

##### event

[`CircuitStateChangeEvent`](CircuitStateChangeEvent.md)

#### Returns

`void`

***

### onError?

> `optional` **onError?**: (`error`) => `void`

Defined in: [src/models/resilience.events.ts:127](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L127)

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

Defined in: [src/models/resilience.events.ts:145](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L145)

Fired when the fallback handler is invoked.

#### Parameters

##### event

[`FallbackEvent`](FallbackEvent.md)

#### Returns

`void`

***

### onRateLimitReject?

> `optional` **onRateLimitReject?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:148](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L148)

Fired when a request is rejected by the rate limiter.

#### Parameters

##### event

[`RateLimitRejectEvent`](RateLimitRejectEvent.md)

#### Returns

`void`

***

### onRecovered?

> `optional` **onRecovered?**: (`event`) => `void`

Defined in: [src/models/resilience.events.ts:131](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L131)

Successful completion after at least one retry (not fallback).

#### Parameters

##### event

[`RecoveredEvent`](RecoveredEvent.md)

#### Returns

`void`

***

### onRequest?

> `optional` **onRequest?**: (`config`) => `void`

Defined in: [src/models/resilience.events.ts:115](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L115)

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

Defined in: [src/models/resilience.events.ts:121](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L121)

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

Defined in: [src/models/resilience.events.ts:136](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.1/src/models/resilience.events.ts#L136)

Fired before each retry attempt.

#### Parameters

##### event

[`RetryEvent`](RetryEvent.md)

#### Returns

`void`

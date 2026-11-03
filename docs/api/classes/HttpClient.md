[**super-http v3.0.0**](../README.md)

***

[super-http](../README.md) / HttpClient

# Class: HttpClient

Defined in: [src/http-client/http.client.ts:337](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L337)

Production-grade HTTP client for Node.js and TypeScript.

**Built for production, not just requests.**

Features (all opt-in via fluent API or presets):
- Connection pooling with TCP keep-alive
- Smart retry with pluggable back-off strategies
- Three-state circuit breaker
- Bulkhead isolation
- Token-bucket rate limiter
- Fallback / graceful degradation
- Request deduplication
- Observability hooks + built-in metrics
- Per-request policy overrides
- Plugin system

## Example

```ts
import { createClient, ExponentialJitterRetryStrategy } from 'super-http'

const api = createClient({ baseURL: 'https://api.example.com', preset: 'resilient-api' })

api.on({ onRetry: ({ attempt }) => logger.warn(`retry #${attempt}`) })
api.use(LoggerPlugin())

const { data } = await api.get<User[]>('/users')
const m = api.metrics() // { requests, success, p95Latency, … }
```

## Constructors

### Constructor

> **new HttpClient**(`baseURL`, `httpClientRequestConfig?`, `circuitBreaker?`, `poolConfig?`): `HttpClient`

Defined in: [src/http-client/http.client.ts:372](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L372)

#### Parameters

##### baseURL

`string`

##### httpClientRequestConfig?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md) = `{}`

##### circuitBreaker?

[`CircuitBreaker`](CircuitBreaker.md)

##### poolConfig?

[`PoolConfig`](../interfaces/PoolConfig.md) = `{}`

#### Returns

`HttpClient`

## Properties

### DEFAULT\_MAX\_BODY\_BYTES

> `readonly` `static` **DEFAULT\_MAX\_BODY\_BYTES**: `number`

Defined in: [src/http-client/http.client.ts:346](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L346)

Body-size ceiling applied to both directions unless overridden.

## Accessors

### isClosed

#### Get Signature

> **get** **isClosed**(): `boolean`

Defined in: [src/http-client/http.client.ts:552](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L552)

Releases everything this client owns: keep-alive sockets on both agents and
any plugin timers.

Dropping the reference is not enough — the agents keep their sockets open
until the remote or the OS closes them, which is why
`HttpClientFactory.clear()` used to leak a socket per cached client.

##### Returns

`boolean`

## Methods

### bulkhead()

> **bulkhead**(`config`): `this`

Defined in: [src/http-client/http.client.ts:673](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L673)

Enables bulkhead isolation — limits concurrent in-flight requests.

#### Parameters

##### config

[`BulkheadConfig`](../interfaces/BulkheadConfig.md)

#### Returns

`this`

#### Example

```ts
client.bulkhead({ maxConcurrent: 20, maxQueue: 100, queueTimeoutMs: 3_000 })
```

***

### circuitBreak()

> **circuitBreak**(`config`): `this`

Defined in: [src/http-client/http.client.ts:656](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L656)

Enables the three-state circuit breaker.

#### Parameters

##### config

[`CircuitBreakerConfig`](../interfaces/CircuitBreakerConfig.md)

#### Returns

`this`

#### Example

```ts
client.circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
```

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [src/http-client/http.client.ts:561](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L561)

#### Returns

`Promise`\<`void`\>

***

### correlate()

> **correlate**(`options?`): `this`

Defined in: [src/http-client/http.client.ts:505](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L505)

Enables correlation-id injection.

Each request gets an id, sent in a header (unless the caller already set
one) and attached to every resilience event, so a retry or a circuit trip
can be traced back to the request that caused it.

#### Parameters

##### options?

[`CorrelationOptions`](../interfaces/CorrelationOptions.md) = `{}`

#### Returns

`this`

#### Example

```ts
client.correlate()                              // x-request-id, uuid
client.correlate({ header: 'x-trace-id' })
```

***

### deadline()

> **deadline**(`ms`): `this`

Defined in: [src/http-client/http.client.ts:704](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L704)

Sets a total time budget (ms) for every request: queue waits, all attempts
and all backoff sleeps combined.

A slow response costs the caller more than a fast failure — it holds their
resources while they wait — so a call needs a bound the caller chooses, not
the sum of whatever each layer happens to allow.

#### Parameters

##### ms

`number`

#### Returns

`this`

#### Example

```ts
client.deadline(2_000) // nothing takes longer than 2 s, retries included
```

***

### dedup()

> **dedup**(`options?`): `this`

Defined in: [src/http-client/http.client.ts:723](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L723)

Enables request deduplication for idempotent calls.

Only `GET` and `HEAD` are coalesced by default, and the request body is
part of the key — two concurrent writes with different payloads are never
collapsed into one.

#### Parameters

##### options?

[`DedupOptions`](../interfaces/DedupOptions.md)

#### Returns

`this`

#### Example

```ts
client.dedup()
client.dedup({ methods: ['GET', 'HEAD', 'POST'] })  // opt in, at your risk
```

***

### delete()

> **delete**\<`T`\>(`url`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:766](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L766)

HTTP DELETE

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### url

`string`

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### fallback()

> **fallback**\<`T`\>(`fn`): `this`

Defined in: [src/http-client/http.client.ts:738](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L738)

Registers a fallback handler invoked when all policies are exhausted.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

(`error`) => `T` \| `Promise`\<`T`\>

#### Returns

`this`

#### Example

```ts
client.fallback((error) => ({ items: [], degraded: true }))
client.fallback(async () => cache.get('last-known-good'))
```

***

### get()

> **get**\<`T`\>(`url`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:746](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L746)

HTTP GET

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### url

`string`

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### metrics()

> **metrics**(): [`MetricsSnapshot`](../interfaces/MetricsSnapshot.md)

Defined in: [src/http-client/http.client.ts:584](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L584)

Returns a point-in-time snapshot of runtime metrics for this client.

#### Returns

[`MetricsSnapshot`](../interfaces/MetricsSnapshot.md)

#### Example

```ts
const m = client.metrics()
console.log(`p99=${m.p99Latency}ms  retries=${m.retries}  cbTrips=${m.circuitBreakerTrips}`)
```

***

### on()

> **on**(`events`): `this`

Defined in: [src/http-client/http.client.ts:467](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L467)

Registers observability hooks. Multiple calls merge handlers (last wins per key).

#### Parameters

##### events

[`ResilienceEvents`](../interfaces/ResilienceEvents.md)

#### Returns

`this`

#### Example

```ts
client.on({
  onRequest:  (cfg) => logger.debug(`→ ${cfg.method} ${cfg.url}`),
  onRetry:    ({ attempt, delayMs }) => metrics.inc('retry', { attempt }),
  onCircuitStateChange: ({ from, to }) => alerts.notify(`circuit ${from}→${to}`),
})
```

***

### onModuleDestroy()

> **onModuleDestroy**(): `Promise`\<`void`\>

Defined in: [src/http-client/http.client.ts:557](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L557)

NestJS invokes this for injected client providers at application shutdown.

#### Returns

`Promise`\<`void`\>

***

### patch()

> **patch**\<`T`\>(`url`, `data?`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:761](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L761)

HTTP PATCH

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### url

`string`

##### data?

`unknown`

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### post()

> **post**\<`T`\>(`url`, `data?`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:751](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L751)

HTTP POST

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### url

`string`

##### data?

`unknown`

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### put()

> **put**\<`T`\>(`url`, `data?`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:756](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L756)

HTTP PUT

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### url

`string`

##### data?

`unknown`

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### rateLimit()

> **rateLimit**(`config`): `this`

Defined in: [src/http-client/http.client.ts:686](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L686)

Enables token-bucket rate limiting.

#### Parameters

##### config

[`RateLimitConfig`](../interfaces/RateLimitConfig.md)

#### Returns

`this`

#### Example

```ts
client.rateLimit({ permitLimit: 200, windowMs: 60_000 })
```

***

### request()

> **request**\<`T`\>(`config`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:784](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L784)

Sends a raw request. Accepts an optional `policy` field to override
client-level resilience config for this single request.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### config

`AxiosRequestConfig`\<`any`, `any`\> & `object`

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

#### Example

```ts
// Tighter timeout + silent fallback for a non-critical endpoint
await client.request({
  url: '/recommendations',
  method: 'get',
  policy: { timeout: 500, retry: false, fallback: () => [] },
})
```

***

### resetMetrics()

> **resetMetrics**(): `this`

Defined in: [src/http-client/http.client.ts:591](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L591)

Resets all accumulated metrics counters and latency history.

#### Returns

`this`

***

### retry()

> **retry**(`retries`, `strategy`, `options?`): `this`

Defined in: [src/http-client/http.client.ts:634](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L634)

Enables automatic retry with a pluggable back-off strategy.

Ambiguous errors — where the request may already have been applied upstream —
are retried only for idempotent methods unless `retryNonIdempotent` is set.

#### Parameters

##### retries

`number`

Max retry attempts.

##### strategy

`number` \| [`RetryStrategy`](../interfaces/RetryStrategy.md)

Delay strategy or fixed ms (backwards-compatible).

##### options?

`number`[] \| [`RetryOptions`](../interfaces/RetryOptions.md)

Status codes to add, or a [RetryOptions](../interfaces/RetryOptions.md) object.

#### Returns

`this`

#### Example

```ts
client.retry(3, new ExponentialJitterRetryStrategy(100, 10_000))
client.retry(3, 500)                   // fixed delay (legacy)
client.retry(3, 500, [429, 503])       // also retry these statuses
client.retry(3, 500, { retryNonIdempotent: true })  // allow POST retries
```

***

### state()

> **state**(): [`ClientState`](../interfaces/ClientState.md)

Defined in: [src/http-client/http.client.ts:521](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L521)

Returns the **current** state of every configured resilience component.

#### Returns

[`ClientState`](../interfaces/ClientState.md)

#### Example

```ts
if (client.state().circuit?.open) skipTheCall()
```

***

### use()

> **use**(`plugin`): `this`

Defined in: [src/http-client/http.client.ts:606](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.client.ts#L606)

Installs a plugin. Each plugin is installed at most once (deduplicated by name).

#### Parameters

##### plugin

[`SuperHttpPlugin`](../interfaces/SuperHttpPlugin.md)

#### Returns

`this`

#### Example

```ts
import { LoggerPlugin, MetricsReporterPlugin } from 'super-http'
client.use(LoggerPlugin({ prefix: '[payments]' }))
client.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
```

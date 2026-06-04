[**super-http v1.0.0**](../README.md)

***

[super-http](../README.md) / HttpClient

# Class: HttpClient

Defined in: [src/http-client/http.client.ts:125](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L125)

A resilient HTTP client that wraps Axios with:
- **Connection pooling** — shared `http.Agent`/`https.Agent` with keep-alive
- **Smart retry** — retries on network errors and 5xx, skips 4xx
- **Circuit breaker** — trips after N failures, recovers automatically

Instantiate via [HttpClientFactory](HttpClientFactory.md) to get singleton-per-baseURL
behaviour with automatic pool reuse. Use the constructor directly when
you need full control.

## Example

```ts
// Factory (recommended)
const client = HttpClientFactory.create('https://api.example.com');
client.retry(3, 500).circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 });
const { data } = await client.get('/users');

// Direct instantiation
const client = new HttpClient('https://api.example.com', {}, undefined, { maxSockets: 100 });
```

## Constructors

### Constructor

> **new HttpClient**(`baseURL`, `httpClientRequestConfig?`, `circuitBreaker?`, `poolConfig?`): `HttpClient`

Defined in: [src/http-client/http.client.ts:140](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L140)

Creates a new `HttpClient`.

#### Parameters

##### baseURL

`string`

The base URL prepended to every request path.

##### httpClientRequestConfig?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md) = `{}`

Default Axios config applied to all requests.

##### circuitBreaker?

[`CircuitBreaker`](CircuitBreaker.md)

An optional pre-configured [CircuitBreaker](CircuitBreaker.md) instance.
  When omitted, one is created lazily the first time `.circuitBreak()` is called.

##### poolConfig?

[`PoolConfig`](../interfaces/PoolConfig.md) = `{}`

Connection pool options.  See [PoolConfig](../interfaces/PoolConfig.md).

#### Returns

`HttpClient`

## Methods

### circuitBreak()

> **circuitBreak**(`config`): `this`

Defined in: [src/http-client/http.client.ts:206](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L206)

Enables the circuit breaker for this client.

#### Parameters

##### config

[`CircuitBreakerConfig`](../interfaces/CircuitBreakerConfig.md)

Circuit breaker thresholds and timeout. See [CircuitBreakerConfig](../interfaces/CircuitBreakerConfig.md).

#### Returns

`this`

`this` — enables fluent chaining.

#### Example

```ts
client.circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 });
```

***

### delete()

> **delete**\<`T`\>(`url`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:277](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L277)

Sends an HTTP `DELETE` request.

#### Type Parameters

##### T

`T` = `any`

Expected response body type.

#### Parameters

##### url

`string`

Request path (appended to `baseURL`).

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

Optional per-request Axios config.

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### get()

> **get**\<`T`\>(`url`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:225](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L225)

Sends an HTTP `GET` request.

#### Type Parameters

##### T

`T` = `any`

Expected response body type.

#### Parameters

##### url

`string`

Request path (appended to `baseURL`).

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

Optional per-request Axios config.

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

#### Example

```ts
const { data } = await client.get<User[]>('/users');
```

***

### patch()

> **patch**\<`T`\>(`url`, `data?`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:266](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L266)

Sends an HTTP `PATCH` request.

#### Type Parameters

##### T

`T` = `any`

Expected response body type.

#### Parameters

##### url

`string`

Request path (appended to `baseURL`).

##### data?

`unknown`

Partial request body.

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

Optional per-request Axios config.

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### post()

> **post**\<`T`\>(`url`, `data?`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:242](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L242)

Sends an HTTP `POST` request.

#### Type Parameters

##### T

`T` = `any`

Expected response body type.

#### Parameters

##### url

`string`

Request path (appended to `baseURL`).

##### data?

`unknown`

Request body.

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

Optional per-request Axios config.

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

#### Example

```ts
const { data } = await client.post<User>('/users', { name: 'Alice' });
```

***

### put()

> **put**\<`T`\>(`url`, `data?`, `config?`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:254](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L254)

Sends an HTTP `PUT` request.

#### Type Parameters

##### T

`T` = `any`

Expected response body type.

#### Parameters

##### url

`string`

Request path (appended to `baseURL`).

##### data?

`unknown`

Request body.

##### config?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

Optional per-request Axios config.

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### request()

> **request**\<`T`\>(`config`): `Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

Defined in: [src/http-client/http.client.ts:288](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L288)

Sends a raw request using the full Axios request config.
Prefer the typed convenience methods (`get`, `post`, …) when possible.

#### Type Parameters

##### T

`T` = `any`

Expected response body type.

#### Parameters

##### config

`AxiosRequestConfig`

Full Axios request configuration.

#### Returns

`Promise`\<[`HttpClientResponse`](../type-aliases/HttpClientResponse.md)\<`T`\>\>

***

### retry()

> **retry**(`retries`, `delayMs`, `retryOn?`): `this`

Defined in: [src/http-client/http.client.ts:190](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L190)

Enables automatic retry for failed requests.

By default, retries are triggered by network errors (`ECONNRESET`,
`ETIMEDOUT`, etc.) and HTTP 5xx responses.  Pass `retryOn` to restrict
retries to specific HTTP status codes instead.

#### Parameters

##### retries

`number`

Maximum number of retry attempts.

##### delayMs

`number`

Fixed delay between attempts in milliseconds.

##### retryOn?

`number`[]

Optional list of HTTP status codes to retry on.
  When provided, network-level errors are **not** retried unless their
  status code appears in this list.

#### Returns

`this`

`this` — enables fluent chaining.

#### Example

```ts
client.retry(3, 500);                // retry any network/5xx error
client.retry(3, 500, [429, 503]);    // retry only 429 and 503
```

[**super-http v3.0.0**](../README.md)

***

[super-http](../README.md) / HttpClientFactory

# Class: HttpClientFactory

Defined in: [src/http-client/http.factory.ts:22](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.factory.ts#L22)

Factory that creates and caches [HttpClient](HttpClient.md) instances keyed by
`baseURL`.

Sharing a single `HttpClient` per base URL means the underlying
connection pool (`http.Agent` / `https.Agent`) is reused across all
callers, avoiding unnecessary TCP handshakes and preventing
keep-alive socket leaks.

## Example

```ts
// Both calls return the same HttpClient instance
const client = HttpClientFactory.create('https://api.example.com');
const same   = HttpClientFactory.create('https://api.example.com');
console.log(client === same); // true
```

## Constructors

### Constructor

> **new HttpClientFactory**(): `HttpClientFactory`

#### Returns

`HttpClientFactory`

## Methods

### clear()

> `static` **clear**(): `void`

Defined in: [src/http-client/http.factory.ts:104](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.factory.ts#L104)

Closes and removes all cached instances.

Primarily useful in tests to ensure each test case starts with a fresh
client and pool. Each client is closed before being dropped: emptying the
map alone left every cached client's keep-alive sockets open, so the call
advertised for test isolation was leaking a pool per invocation.

#### Returns

`void`

#### Example

```ts
afterEach(() => HttpClientFactory.clear());
```

***

### create()

> `static` **create**(`baseURL`, `httpConfig?`, `poolConfig?`, `initialize?`): [`HttpClient`](HttpClient.md)

Defined in: [src/http-client/http.factory.ts:53](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.factory.ts#L53)

Returns the cached `HttpClient` for `baseURL`, or creates a new one.

The first call for a given `baseURL` initialises a dedicated
[CircuitBreaker](CircuitBreaker.md) and connection pool. Subsequent calls with the
same URL return the cached instance — `httpConfig` and `poolConfig` are
**ignored** on cache hits.

#### Parameters

##### baseURL

`string`

Base URL for all requests made by this client.

##### httpConfig?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

Default Axios request config (headers, auth, …).

##### poolConfig?

[`PoolConfig`](../interfaces/PoolConfig.md)

Connection pool options. See [PoolConfig](../interfaces/PoolConfig.md).

##### initialize?

(`client`) => `void`

Optional setup, executed only for a newly created client, before caching.

#### Returns

[`HttpClient`](HttpClient.md)

A configured [HttpClient](HttpClient.md).

#### Example

```ts
const api = HttpClientFactory.create('https://api.example.com', {
  headers: { Authorization: `Bearer ${token}` },
}, {
  maxSockets: 100,
  timeout: 15_000,
});

api.retry(3, 500).circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 });

const { data } = await api.get('/users');
```

***

### createIsolated()

> `static` **createIsolated**(`baseURL`, `httpConfig?`, `poolConfig?`, `initialize?`): [`HttpClient`](HttpClient.md)

Defined in: [src/http-client/http.factory.ts:71](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/http-client/http.factory.ts#L71)

Creates an uncached client with independent pool and resilience state.

#### Parameters

##### baseURL

`string`

##### httpConfig?

[`HttpClientRequestConfig`](../interfaces/HttpClientRequestConfig.md)

##### poolConfig?

[`PoolConfig`](../interfaces/PoolConfig.md)

##### initialize?

(`client`) => `void`

#### Returns

[`HttpClient`](HttpClient.md)

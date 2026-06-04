[**super-http v1.0.0**](../README.md)

***

[super-http](../README.md) / PoolConfig

# Interface: PoolConfig

Defined in: [src/http-client/http.client.ts:36](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L36)

Options for the underlying Node.js HTTP/HTTPS connection pool.

These values are passed directly to `http.Agent` and `https.Agent`.
Tuning the pool allows you to balance throughput against resource usage
for your specific workload.

## Example

```ts
const pool: PoolConfig = {
  maxSockets: 100,
  maxFreeSockets: 20,
  keepAlive: true,
  keepAliveMsecs: 2000,
  timeout: 15_000,
};
```

## Properties

### keepAlive?

> `optional` **keepAlive?**: `boolean`

Defined in: [src/http-client/http.client.ts:54](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L54)

Enable TCP keep-alive on sockets.  Prevents `ECONNRESET` errors that
occur when a server closes an idle persistent connection.

#### Default Value

```ts
true
```

***

### keepAliveMsecs?

> `optional` **keepAliveMsecs?**: `number`

Defined in: [src/http-client/http.client.ts:60](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L60)

Delay between keep-alive probes in milliseconds.

#### Default Value

```ts
1000
```

***

### maxFreeSockets?

> `optional` **maxFreeSockets?**: `number`

Defined in: [src/http-client/http.client.ts:47](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L47)

Maximum number of idle (keep-alive) sockets to keep open per host.

#### Default Value

```ts
10
```

***

### maxSockets?

> `optional` **maxSockets?**: `number`

Defined in: [src/http-client/http.client.ts:41](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L41)

Maximum number of concurrent open sockets per host.

#### Default Value

```ts
50
```

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: [src/http-client/http.client.ts:67](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/http-client/http.client.ts#L67)

Global request timeout in milliseconds.  Overrides the value in
[HttpClientRequestConfig](HttpClientRequestConfig.md) when both are set.

#### Default Value

```ts
30000
```

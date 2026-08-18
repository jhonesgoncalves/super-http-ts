[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / PoolConfig

# Interface: PoolConfig

Defined in: [src/http-client/http.client.ts:137](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L137)

Options for the underlying Node.js HTTP/HTTPS connection pool.

## Properties

### keepAlive?

> `optional` **keepAlive?**: `boolean`

Defined in: [src/http-client/http.client.ts:151](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L151)

Enable TCP keep-alive.

#### Default Value

```ts
true
```

***

### keepAliveMsecs?

> `optional` **keepAliveMsecs?**: `number`

Defined in: [src/http-client/http.client.ts:153](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L153)

Keep-alive probe interval (ms).

#### Default Value

```ts
1000
```

***

### maxBodyLength?

> `optional` **maxBodyLength?**: `number`

Defined in: [src/http-client/http.client.ts:184](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L184)

Max request body sent, in bytes.

#### Default Value

```ts
33554432 (32 MiB)
```

***

### maxContentLength?

> `optional` **maxContentLength?**: `number`

Defined in: [src/http-client/http.client.ts:179](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L179)

Max response body accepted, in bytes. Axios defaults to unlimited, so a
runaway upstream can exhaust the client's memory.

#### Default Value

```ts
33554432 (32 MiB)
```

***

### maxFreeSockets?

> `optional` **maxFreeSockets?**: `number`

Defined in: [src/http-client/http.client.ts:149](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L149)

Max idle keep-alive sockets per host.

#### Default Value

```ts
50
```

***

### maxSockets?

> `optional` **maxSockets?**: `number`

Defined in: [src/http-client/http.client.ts:147](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L147)

Max concurrent sockets per host.

Sized for burst headroom rather than average load: steady-state demand is
roughly `rps * latencySeconds`, so the default only starts to bind when
upstream latency degrades.

#### Default Value

```ts
200
```

***

### socketTimeoutMs?

> `optional` **socketTimeoutMs?**: `number`

Defined in: [src/http-client/http.client.ts:172](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L172)

Socket inactivity timeout (ms) applied to the agent itself.

Without this, a connection that goes quiet — a NAT or firewall dropping a
half-open socket — is only noticed by the response timeout, and a socket
stuck in connect is bounded by nothing else. Node's `http.Agent` does not
expose a separate connect timeout, so this covers inactivity at any stage.

Defaults to [PoolConfig.timeout](#timeout).

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: [src/http-client/http.client.ts:161](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L161)

Response timeout (ms) — how long to wait for the upstream to answer a
request. This is the axios-level timeout; it does not bound how long a
socket may sit idle. See [PoolConfig.socketTimeoutMs](#sockettimeoutms).

#### Default Value

```ts
30000
```

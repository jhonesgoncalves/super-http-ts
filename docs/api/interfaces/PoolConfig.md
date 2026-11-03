[**super-http v2.1.0**](../README.md)

***

[super-http](../README.md) / PoolConfig

# Interface: PoolConfig

Defined in: [src/http-client/http.client.ts:160](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L160)

Options for the underlying Node.js HTTP/HTTPS connection pool.

## Properties

### freeSocketTimeoutMs?

> `optional` **freeSocketTimeoutMs?**: `number`

Defined in: [src/http-client/http.client.ts:172](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L172)

Retire free sockets after this idle period; 0 disables this additional cap.

***

### keepAlive?

> `optional` **keepAlive?**: `boolean`

Defined in: [src/http-client/http.client.ts:182](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L182)

Enable TCP keep-alive.

#### Default Value

```ts
true
```

***

### keepAliveMsecs?

> `optional` **keepAliveMsecs?**: `number`

Defined in: [src/http-client/http.client.ts:184](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L184)

Initial delay before TCP keep-alive probes (not an HTTP idle TTL).

#### Default Value

```ts
1000
```

***

### keepAliveTimeoutBufferMs?

> `optional` **keepAliveTimeoutBufferMs?**: `number`

Defined in: [src/http-client/http.client.ts:176](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L176)

Margin subtracted from the server's keep-alive timeout hint. Default 1000 ms.

***

### maxBodyLength?

> `optional` **maxBodyLength?**: `number`

Defined in: [src/http-client/http.client.ts:214](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L214)

Max request body sent, in bytes.

#### Default Value

```ts
33554432 (32 MiB)
```

***

### maxContentLength?

> `optional` **maxContentLength?**: `number`

Defined in: [src/http-client/http.client.ts:209](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L209)

Max response body accepted, in bytes. Axios defaults to unlimited, so a
runaway upstream can exhaust the client's memory.

#### Default Value

```ts
33554432 (32 MiB)
```

***

### maxFreeSockets?

> `optional` **maxFreeSockets?**: `number`

Defined in: [src/http-client/http.client.ts:180](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L180)

Max idle keep-alive sockets per host.

#### Default Value

```ts
50
```

***

### maxSocketAgeMs?

> `optional` **maxSocketAgeMs?**: `number`

Defined in: [src/http-client/http.client.ts:174](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L174)

Retire aged sockets when they become idle, never during an active call.

***

### maxSockets?

> `optional` **maxSockets?**: `number`

Defined in: [src/http-client/http.client.ts:170](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L170)

Max concurrent sockets per host.

Sized for burst headroom rather than average load: steady-state demand is
roughly `rps * latencySeconds`, so the default only starts to bind when
upstream latency degrades.

#### Default Value

```ts
200
```

***

### scheduling?

> `optional` **scheduling?**: `"lifo"` \| `"fifo"`

Defined in: [src/http-client/http.client.ts:178](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L178)

Socket selection strategy. Default lifo.

***

### socketTimeoutMs?

> `optional` **socketTimeoutMs?**: `number`

Defined in: [src/http-client/http.client.ts:202](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L202)

Socket inactivity timeout (ms) applied to the agent itself.

This native Agent setting is not an independent connect-timeout guarantee;
Axios timeout/cancellation also apply to active requests. Use
freeSocketTimeoutMs for an idle-only cap and deadline() for the whole call.

Defaults to [PoolConfig.timeout](#timeout).

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: [src/http-client/http.client.ts:192](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/http-client/http.client.ts#L192)

Response timeout (ms) — how long to wait for the upstream to answer a
request. This is the axios-level timeout; it does not bound how long a
socket may sit idle. See [PoolConfig.socketTimeoutMs](#sockettimeoutms).

#### Default Value

```ts
30000
```

[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / BulkheadConfig

# Interface: BulkheadConfig

Defined in: [src/bulkhead/bulkhead.ts:17](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L17)

Configuration for the [Bulkhead](../classes/Bulkhead.md) isolation pattern.

A bulkhead limits the number of concurrent calls to a service and optionally
queues excess calls. When the queue is also full, new calls are rejected
immediately — preventing one slow downstream from consuming all resources.

## Example

```ts
client.bulkhead({ maxConcurrent: 10, maxQueue: 50, queueTimeoutMs: 2000 })
```

## Properties

### maxConcurrent

> **maxConcurrent**: `number`

Defined in: [src/bulkhead/bulkhead.ts:22](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L22)

Maximum number of in-flight (active) requests at any moment.

#### Default Value

```ts
10
```

***

### maxQueue?

> `optional` **maxQueue?**: `number`

Defined in: [src/bulkhead/bulkhead.ts:29](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L29)

Maximum number of requests waiting in the queue for a slot.
When the queue is full, new requests are rejected immediately.

#### Default Value

```ts
50
```

***

### queueTimeoutMs?

> `optional` **queueTimeoutMs?**: `number`

Defined in: [src/bulkhead/bulkhead.ts:41](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L41)

How long (ms) a queued request may wait before being rejected.

Defaults to [Bulkhead.DEFAULT\_QUEUE\_TIMEOUT\_MS](../classes/Bulkhead.md#default_queue_timeout_ms). Waiting forever is a
blocked thread by another name — the most common way a healthy service is
taken down by a sick dependency — so it has to be asked for explicitly with
`Infinity`.

#### Default Value

```ts
10000
```

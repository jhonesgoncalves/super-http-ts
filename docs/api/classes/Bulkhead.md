[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / Bulkhead

# Class: Bulkhead

Defined in: [src/bulkhead/bulkhead.ts:56](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L56)

Bulkhead isolation — limits concurrent access to a resource.

Inspired by Polly's `BulkheadPolicy` and Resilience4j's `Bulkhead`.
Uses an async semaphore with an optional bounded queue.

## Example

```ts
const bh = new Bulkhead({ maxConcurrent: 10, maxQueue: 50 });
const result = await bh.execute(() => fetch('/api/data'));
```

## Constructors

### Constructor

> **new Bulkhead**(`config`, `events?`): `Bulkhead`

Defined in: [src/bulkhead/bulkhead.ts:68](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L68)

#### Parameters

##### config

[`BulkheadConfig`](../interfaces/BulkheadConfig.md)

##### events?

`Pick`\<[`ResilienceEvents`](../interfaces/ResilienceEvents.md), `"onBulkheadReject"`\>

#### Returns

`Bulkhead`

## Properties

### DEFAULT\_QUEUE\_TIMEOUT\_MS

> `readonly` `static` **DEFAULT\_QUEUE\_TIMEOUT\_MS**: `10000` = `10_000`

Defined in: [src/bulkhead/bulkhead.ts:58](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L58)

Queue wait applied when `queueTimeoutMs` is omitted.

## Accessors

### activeCount

#### Get Signature

> **get** **activeCount**(): `number`

Defined in: [src/bulkhead/bulkhead.ts:80](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L80)

Current number of active (in-flight) requests.

##### Returns

`number`

***

### queuedCount

#### Get Signature

> **get** **queuedCount**(): `number`

Defined in: [src/bulkhead/bulkhead.ts:85](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L85)

Current number of requests waiting in the queue.

##### Returns

`number`

## Methods

### execute()

> **execute**\<`T`\>(`fn`, `opts?`): `Promise`\<`T`\>

Defined in: [src/bulkhead/bulkhead.ts:97](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/bulkhead/bulkhead.ts#L97)

Executes `fn` within the bulkhead.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

##### opts?

###### maxWaitMs?

`number`

###### signal?

`AbortSignal`

#### Returns

`Promise`\<`T`\>

#### Throws

`Error('Bulkhead queue full')` when both the active slot and the
  queue are at capacity.

#### Throws

`Error('Bulkhead queue timeout')` when a queued request exceeds
  `queueTimeoutMs`.

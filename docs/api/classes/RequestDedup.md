[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / RequestDedup

# Class: RequestDedup

Defined in: [src/dedup/request-dedup.ts:27](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/dedup/request-dedup.ts#L27)

Coalesces identical in-flight requests into a single network call.

When multiple callers request the same resource simultaneously, only one
HTTP request is sent. All callers receive the same resolved (or rejected)
value. Once the request settles, the entry is removed — subsequent calls
start a fresh request.

**Only idempotent requests (GET, HEAD) are deduplicated by default.**
Coalescing a write would hand one caller another caller's result, so the
eligible method set is opt-in — see [DedupOptions.methods](../interfaces/DedupOptions.md#methods).

## Example

```ts
const dedup = new RequestDedup()

// Three simultaneous calls → one HTTP request
const [a, b, c] = await Promise.all([
  dedup.execute('GET:/users/1', () => client.get('/users/1')),
  dedup.execute('GET:/users/1', () => client.get('/users/1')),
  dedup.execute('GET:/users/1', () => client.get('/users/1')),
])
```

## Constructors

### Constructor

> **new RequestDedup**(`ttlMs?`): `RequestDedup`

Defined in: [src/dedup/request-dedup.ts:38](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/dedup/request-dedup.ts#L38)

#### Parameters

##### ttlMs?

`number` = `RequestDedup.DEFAULT_TTL_MS`

Age after which an in-flight entry stops being joinable.
  A request that never settles would otherwise pin its key forever, and every
  later identical call would join the same doomed promise.

#### Returns

`RequestDedup`

## Properties

### DEFAULT\_TTL\_MS

> `readonly` `static` **DEFAULT\_TTL\_MS**: `30000` = `30_000`

Defined in: [src/dedup/request-dedup.ts:29](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/dedup/request-dedup.ts#L29)

How long an in-flight entry may be joined before it is considered stale.

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [src/dedup/request-dedup.ts:62](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/dedup/request-dedup.ts#L62)

Number of in-flight deduplicated requests.

##### Returns

`number`

## Methods

### execute()

> **execute**\<`T`\>(`key`, `fn`): `Promise`\<`T`\>

Defined in: [src/dedup/request-dedup.ts:46](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/dedup/request-dedup.ts#L46)

Executes `fn`, coalescing concurrent calls with the same `key`.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

A unique string identifying this request (e.g. `"GET:/users/1"`).

##### fn

() => `Promise`\<`T`\>

The async function to execute (called at most once per key at a time).

#### Returns

`Promise`\<`T`\>

[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / CorrelationOptions

# Interface: CorrelationOptions

Defined in: [src/http-client/http.client.ts:121](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L121)

Options for correlation-id injection.

## Properties

### generate?

> `optional` **generate?**: () => `string`

Defined in: [src/http-client/http.client.ts:131](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L131)

Generates the id.

#### Returns

`string`

#### Default Value

`crypto.randomUUID()`

***

### header?

> `optional` **header?**: `string`

Defined in: [src/http-client/http.client.ts:126](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/http-client/http.client.ts#L126)

Header carrying the id.

#### Default Value

```ts
'x-request-id'
```

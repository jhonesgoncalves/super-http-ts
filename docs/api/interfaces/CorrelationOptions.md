[**super-http v2.1.2**](../README.md)

***

[super-http](../README.md) / CorrelationOptions

# Interface: CorrelationOptions

Defined in: [src/http-client/http.client.ts:144](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/http-client/http.client.ts#L144)

Options for correlation-id injection.

## Properties

### generate?

> `optional` **generate?**: () => `string`

Defined in: [src/http-client/http.client.ts:154](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/http-client/http.client.ts#L154)

Generates the id.

#### Returns

`string`

#### Default Value

`crypto.randomUUID()`

***

### header?

> `optional` **header?**: `string`

Defined in: [src/http-client/http.client.ts:149](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/http-client/http.client.ts#L149)

Header carrying the id.

#### Default Value

```ts
'x-request-id'
```

[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / LoggerPluginOptions

# Interface: LoggerPluginOptions

Defined in: [src/plugins/index.ts:39](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L39)

## Properties

### level?

> `optional` **level?**: `"debug"` \| `"info"` \| `"warn"` \| `"error"`

Defined in: [src/plugins/index.ts:44](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L44)

Log level — maps to `console.debug`, `console.log`, `console.warn`, `console.error`.

#### Default Value

```ts
'info'
```

***

### logRequests?

> `optional` **logRequests?**: `boolean`

Defined in: [src/plugins/index.ts:48](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L48)

Log request lines.

#### Default Value

```ts
true
```

***

### logResilience?

> `optional` **logResilience?**: `boolean`

Defined in: [src/plugins/index.ts:52](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L52)

Log resilience events (retry, CB, etc.).

#### Default Value

```ts
true
```

***

### logResponses?

> `optional` **logResponses?**: `boolean`

Defined in: [src/plugins/index.ts:50](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L50)

Log response lines.

#### Default Value

```ts
true
```

***

### prefix?

> `optional` **prefix?**: `string`

Defined in: [src/plugins/index.ts:46](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L46)

Optional prefix for all log lines.

#### Default Value

```ts
'[super-http]'
```

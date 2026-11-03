[**super-http v2.1.0**](../README.md)

***

[super-http](../README.md) / DedupOptions

# Interface: DedupOptions

Defined in: [src/dedup/request-dedup.ts:77](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/dedup/request-dedup.ts#L77)

Options for [RequestDedup](../classes/RequestDedup.md) keying, set via `client.dedup(...)`.

## Properties

### methods?

> `optional` **methods?**: `string`[]

Defined in: [src/dedup/request-dedup.ts:82](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/dedup/request-dedup.ts#L82)

HTTP methods eligible for coalescing, upper- or lower-case.

#### Default Value

`['GET', 'HEAD']`

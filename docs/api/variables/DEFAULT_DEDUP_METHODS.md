[**super-http v2.1.2**](../README.md)

***

[super-http](../README.md) / DEFAULT\_DEDUP\_METHODS

# Variable: DEFAULT\_DEDUP\_METHODS

> `const` **DEFAULT\_DEDUP\_METHODS**: readonly `string`[]

Defined in: [src/dedup/request-dedup.ts:74](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/dedup/request-dedup.ts#L74)

Methods eligible for coalescing unless overridden.

Restricted to the two methods that carry no side effects. `PUT` and `DELETE`
are idempotent but not side-effect-free: coalescing two concurrent `PUT`s
would silently discard one writer's payload.

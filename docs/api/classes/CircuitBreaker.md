[**super-http v1.0.0**](../README.md)

***

[super-http](../README.md) / CircuitBreaker

# Class: CircuitBreaker

Defined in: [src/circuit-breaker/circuit-break.ts:54](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L54)

A simple three-state circuit breaker (closed → open → half-open).

**States:**
- **Closed** — requests flow normally. Failures are counted.
- **Open** — requests fail immediately with `"Circuit breaker is open"`.
  After `timeoutMs` the circuit moves to half-open.
- **Half-open** — a single probe is allowed through. Success closes the
  circuit; failure re-opens it and resets the timeout.

## Example

```ts
const cb = new CircuitBreaker();
cb.setConfig({ failureThreshold: 3, successThreshold: 1, timeoutMs: 5000 });

const response = await cb.execute(() => axios.get('/api/data'));
```

## Constructors

### Constructor

> **new CircuitBreaker**(): `CircuitBreaker`

#### Returns

`CircuitBreaker`

## Properties

### isOpen

> **isOpen**: `boolean` = `false`

Defined in: [src/circuit-breaker/circuit-break.ts:60](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L60)

Whether the circuit is currently open (tripped).

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`AxiosResponse`\<`T`, `any`\>\>

Defined in: [src/circuit-breaker/circuit-break.ts:81](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L81)

Wraps an async function with circuit-breaker protection.

#### Type Parameters

##### T

`T`

The type of the resolved value.

#### Parameters

##### fn

() => `Promise`\<`AxiosResponse`\<`T`, `any`\>\>

The async function to protect.

#### Returns

`Promise`\<`AxiosResponse`\<`T`, `any`\>\>

A promise that resolves with the function's result.

#### Throws

`Error('Circuit breaker is open')` when the circuit is tripped
        and the timeout has not yet elapsed.

***

### handleIsOpen()

> **handleIsOpen**(): `boolean`

Defined in: [src/circuit-breaker/circuit-break.ts:108](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L108)

Checks the open state and throws if the circuit is open and the timeout
has not elapsed.  Useful for guard-checking before initiating work that
isn't wrapped via [execute](#execute).

#### Returns

`boolean`

`false` when the circuit is closed (requests may proceed).

#### Throws

`Error('Circuit breaker is open')` when the circuit is open.

***

### setConfig()

> **setConfig**(`config`): `void`

Defined in: [src/circuit-breaker/circuit-break.ts:68](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L68)

Sets or updates the circuit breaker configuration.

#### Parameters

##### config

[`CircuitBreakerConfig`](../interfaces/CircuitBreakerConfig.md)

The new [CircuitBreakerConfig](../interfaces/CircuitBreakerConfig.md).

#### Returns

`void`

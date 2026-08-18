[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / CircuitBreakerConfig

# Interface: CircuitBreakerConfig

Defined in: [src/circuit-breaker/circuit-break.ts:16](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L16)

Configuration options for the [CircuitBreaker](../classes/CircuitBreaker.md).

## Example

```ts
const config: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 10_000,
};
```

## Properties

### failureThreshold

> **failureThreshold**: `number`

Defined in: [src/circuit-breaker/circuit-break.ts:20](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L20)

Number of consecutive failures required to trip (open) the circuit.

***

### shouldTrip?

> `optional` **shouldTrip?**: (`error`) => `boolean`

Defined in: [src/circuit-breaker/circuit-break.ts:45](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L45)

Decides whether an error counts toward `failureThreshold`.

A circuit breaker is supposed to track the health of the integration point,
not the caller's mistakes. Without this predicate every rejection counts, so
a burst of `404`s or `401`s — answers from a perfectly healthy upstream —
trips the circuit and takes down the traffic that was working.

Errors the predicate rejects propagate to the caller unchanged; they simply
do not move the failure counter. Defaults to counting everything.

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### successThreshold

> **successThreshold**: `number`

Defined in: [src/circuit-breaker/circuit-break.ts:26](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L26)

Number of consecutive successes required to close the circuit from
the half-open state.

***

### timeoutMs

> **timeoutMs**: `number`

Defined in: [src/circuit-breaker/circuit-break.ts:32](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L32)

Time in milliseconds the circuit stays open before allowing a single
probe request through (half-open state).

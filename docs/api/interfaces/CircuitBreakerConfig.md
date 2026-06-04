[**super-http v1.0.0**](../README.md)

***

[super-http](../README.md) / CircuitBreakerConfig

# Interface: CircuitBreakerConfig

Defined in: [src/circuit-breaker/circuit-break.ts:15](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L15)

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

Defined in: [src/circuit-breaker/circuit-break.ts:21](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L21)

Number of consecutive failures required to trip (open) the circuit.
Once this threshold is reached, requests fail immediately without
reaching the upstream service.

***

### successThreshold

> **successThreshold**: `number`

Defined in: [src/circuit-breaker/circuit-break.ts:27](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L27)

Number of consecutive successes required to close the circuit after
a successful probe in the half-open state.

***

### timeoutMs

> **timeoutMs**: `number`

Defined in: [src/circuit-breaker/circuit-break.ts:33](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/circuit-breaker/circuit-break.ts#L33)

Time in milliseconds the circuit stays open before allowing a single
probe request through (half-open state).

[**super-http v2.1.2**](../README.md)

***

[super-http](../README.md) / CircuitStateChangeEvent

# Interface: CircuitStateChangeEvent

Defined in: [src/models/resilience.events.ts:50](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/models/resilience.events.ts#L50)

Context passed to `onCircuitStateChange`.

## Properties

### failures

> **failures**: `number`

Defined in: [src/models/resilience.events.ts:54](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/models/resilience.events.ts#L54)

Total failures at the time of the transition.

***

### from

> **from**: [`CircuitState`](../type-aliases/CircuitState.md)

Defined in: [src/models/resilience.events.ts:51](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/models/resilience.events.ts#L51)

***

### to

> **to**: [`CircuitState`](../type-aliases/CircuitState.md)

Defined in: [src/models/resilience.events.ts:52](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.2/src/models/resilience.events.ts#L52)

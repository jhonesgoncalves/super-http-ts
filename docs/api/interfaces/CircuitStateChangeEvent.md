[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / CircuitStateChangeEvent

# Interface: CircuitStateChangeEvent

Defined in: [src/models/resilience.events.ts:29](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L29)

Context passed to `onCircuitStateChange`.

## Properties

### failures

> **failures**: `number`

Defined in: [src/models/resilience.events.ts:33](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L33)

Total failures at the time of the transition.

***

### from

> **from**: [`CircuitState`](../type-aliases/CircuitState.md)

Defined in: [src/models/resilience.events.ts:30](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L30)

***

### to

> **to**: [`CircuitState`](../type-aliases/CircuitState.md)

Defined in: [src/models/resilience.events.ts:31](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/resilience.events.ts#L31)

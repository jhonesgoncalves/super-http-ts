[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / CircuitBreaker

# Class: CircuitBreaker

Defined in: [src/circuit-breaker/circuit-break.ts:70](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L70)

A three-state circuit breaker (closed → open → half-open).

Inspired by Polly's `CircuitBreakerPolicy` and Resilience4j's `CircuitBreaker`.

**States:**
- **Closed** — requests flow normally. Failures are counted.
- **Open** — requests fail immediately with `"Circuit breaker is open"`.
  After `timeoutMs` the circuit moves to half-open.
- **Half-open** — a single probe is allowed through. Success closes the
  circuit; failure re-opens it and resets the timeout.

## Example

```ts
const cb = new CircuitBreaker();
cb.setConfig(
  { failureThreshold: 3, successThreshold: 1, timeoutMs: 5000 },
  { onCircuitStateChange: ({ from, to }) => console.log(`${from} → ${to}`) },
);
const response = await cb.execute(() => axios.get('/api/data'));
```

## Constructors

### Constructor

> **new CircuitBreaker**(): `CircuitBreaker`

#### Returns

`CircuitBreaker`

## Accessors

### isConfigured

#### Get Signature

> **get** **isConfigured**(): `boolean`

Defined in: [src/circuit-breaker/circuit-break.ts:111](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L111)

`true` when this breaker has never been configured.

##### Returns

`boolean`

***

### isOpen

#### Get Signature

> **get** **isOpen**(): `boolean`

Defined in: [src/circuit-breaker/circuit-break.ts:85](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L85)

`true` when the circuit is open (tripped).

##### Returns

`boolean`

***

### state

#### Get Signature

> **get** **state**(): [`CircuitState`](../type-aliases/CircuitState.md)

Defined in: [src/circuit-breaker/circuit-break.ts:80](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L80)

Current circuit state.

##### Returns

[`CircuitState`](../type-aliases/CircuitState.md)

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`T`\>

Defined in: [src/circuit-breaker/circuit-break.ts:122](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L122)

Wraps an async function with circuit-breaker protection.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

#### Throws

`Error('Circuit breaker is open')` when the circuit is open and
  the timeout has not elapsed, or when the circuit is half-open and a
  probe request is already in flight.

***

### handleIsOpen()

> **handleIsOpen**(): `boolean`

Defined in: [src/circuit-breaker/circuit-break.ts:158](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L158)

Guard check: throws if the circuit is open and timeout has not elapsed.
Returns `false` when the circuit is closed (safe to proceed).

#### Returns

`boolean`

***

### setConfig()

> **setConfig**(`config`, `events?`): `void`

Defined in: [src/circuit-breaker/circuit-break.ts:99](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/circuit-breaker/circuit-break.ts#L99)

Sets or updates the circuit breaker configuration and optional event hooks.

Intended to be called **once**, at wiring time. Reconfiguring a breaker
that is already accumulating state changes the thresholds the existing
counters are compared against — prefer a dedicated instance per config.

#### Parameters

##### config

[`CircuitBreakerConfig`](../interfaces/CircuitBreakerConfig.md)

The new [CircuitBreakerConfig](../interfaces/CircuitBreakerConfig.md).

##### events?

`Pick`\<[`ResilienceEvents`](../interfaces/ResilienceEvents.md), `"onCircuitStateChange"`\>

Optional observability hooks.

#### Returns

`void`

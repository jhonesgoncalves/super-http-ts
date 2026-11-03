[**super-http v3.0.0**](../README.md)

***

[super-http](../README.md) / createClient

# Function: createClient()

> **createClient**(`options`): [`HttpClient`](../classes/HttpClient.md)

Defined in: [src/presets/index.ts:101](https://github.com/jhonesgoncalves/super-http-ts/blob/v3.0.0/src/presets/index.ts#L101)

Create an HTTP client with an optional managed resilience profile.

Presets retire idle sockets, honour upstream keep-alive hints and bound every
logical call. Retries preserve method/body safety; ambiguous POST/PATCH errors
are not replayed. Circuit breakers use the client's HTTP failure classifier.
Capacity is local concurrency, not a distributed traffic limit or autoscaling.

The shared factory remains first-configuration-wins. Use `isolated: true` for
independent policies against the same URL. Requests without a preset keep
their existing manual configuration behaviour.

## Parameters

### options

[`CreateClientOptions`](../interfaces/CreateClientOptions.md)

## Returns

[`HttpClient`](../classes/HttpClient.md)

## Example

```ts
const members = createClient({
  baseURL: 'https://members.example',
  preset: 'resilient-api',
  isolated: true,
})
// Optional: scale all admission/pool limits using one budget.
const catalog = createClient({
  baseURL: 'https://catalog.example',
  preset: 'high-throughput',
  capacity: 64,
  deadlineMs: 2_000,
})
```

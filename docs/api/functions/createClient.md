[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / createClient

# Function: createClient()

> **createClient**(`options`): [`HttpClient`](../classes/HttpClient.md)

Defined in: [src/presets/index.ts:116](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/presets/index.ts#L116)

Creates a new `HttpClient` with optional preset configuration.

Equivalent to `HttpClientFactory.create()` with the added convenience
of preset-based defaults. Individual calls to `.retry()`, `.circuitBreak()`,
etc. always override preset settings.

## Parameters

### options

[`CreateClientOptions`](../interfaces/CreateClientOptions.md)

## Returns

[`HttpClient`](../classes/HttpClient.md)

## Example

```ts
// Resilient external API client
const payments = createClient({
  baseURL: 'https://payments.internal',
  preset: 'resilient-api',
  headers: { 'X-API-Key': process.env.PAYMENTS_KEY },
})

// High-throughput internal service
const catalog = createClient({
  baseURL: 'https://catalog.internal',
  preset: 'high-throughput',
  pool: { maxSockets: 300 },  // override pool
})

// No preset — manual config
const custom = createClient({ baseURL: 'https://api.example.com' })
  .retry(3, new ExponentialJitterRetryStrategy(100, 5_000))
```

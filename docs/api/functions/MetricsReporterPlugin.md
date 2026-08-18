[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / MetricsReporterPlugin

# Function: MetricsReporterPlugin()

> **MetricsReporterPlugin**(`options?`): [`SuperHttpPlugin`](../interfaces/SuperHttpPlugin.md)

Defined in: [src/plugins/index.ts:112](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L112)

Metrics reporter plugin — logs a metrics summary on a configurable interval.

## Parameters

### options?

#### intervalMs?

`number`

## Returns

[`SuperHttpPlugin`](../interfaces/SuperHttpPlugin.md)

## Example

```ts
client.use(MetricsReporterPlugin({ intervalMs: 60_000 }))
```

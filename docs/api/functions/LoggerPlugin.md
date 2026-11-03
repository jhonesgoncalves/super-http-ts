[**super-http v2.1.0**](../README.md)

***

[super-http](../README.md) / LoggerPlugin

# Function: LoggerPlugin()

> **LoggerPlugin**(`options?`): [`SuperHttpPlugin`](../interfaces/SuperHttpPlugin.md)

Defined in: [src/plugins/index.ts:63](https://github.com/jhonesgoncalves/super-http-ts/blob/v2.1.0/src/plugins/index.ts#L63)

Structured console logger plugin.

## Parameters

### options?

[`LoggerPluginOptions`](../interfaces/LoggerPluginOptions.md) = `{}`

## Returns

[`SuperHttpPlugin`](../interfaces/SuperHttpPlugin.md)

## Example

```ts
client.use(LoggerPlugin({ prefix: '[payments-api]', level: 'debug' }))
```

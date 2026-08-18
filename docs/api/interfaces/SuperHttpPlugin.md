[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / SuperHttpPlugin

# Interface: SuperHttpPlugin

Defined in: [src/plugins/index.ts:24](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L24)

A super-http plugin.

Plugins are the standard extension point for cross-cutting concerns such as
logging, distributed tracing, or custom metrics backends.

## Example

```ts
const MyPlugin: SuperHttpPlugin = {
  name: 'my-plugin',
  install(client) {
    client.on({
      onRequest:  (cfg) => console.log(`→ ${cfg.method} ${cfg.url}`),
      onResponse: (res) => console.log(`← ${res.status}`),
    });
  },
};

client.use(MyPlugin);
```

## Properties

### name

> **name**: `string`

Defined in: [src/plugins/index.ts:26](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L26)

Unique name — prevents the same plugin being installed twice.

## Methods

### install()

> **install**(`client`): `void`

Defined in: [src/plugins/index.ts:28](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L28)

Called once when the plugin is installed on a client.

#### Parameters

##### client

[`HttpClient`](../classes/HttpClient.md)

#### Returns

`void`

***

### uninstall()?

> `optional` **uninstall**(`client`): `void`

Defined in: [src/plugins/index.ts:34](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/plugins/index.ts#L34)

Called by [HttpClient.close](../classes/HttpClient.md#close) — release timers, sockets and listeners
here. A plugin that arms an interval and never clears it keeps working after
the client it belongs to is gone.

#### Parameters

##### client

[`HttpClient`](../classes/HttpClient.md)

#### Returns

`void`

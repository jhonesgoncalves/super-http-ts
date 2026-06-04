[**super-http v1.0.0**](../README.md)

***

[super-http](../README.md) / HttpClientRequestConfig

# Interface: HttpClientRequestConfig

Defined in: [src/models/http.client.request.config.ts:3](https://github.com/jhonesgoncalves/super-http-ts/blob/343ba080e74d310b0ef878b233587a6c610988e8/src/models/http.client.request.config.ts#L3)

## Extends

- `AxiosRequestConfig`

## Properties

### adapter?

> `optional` **adapter?**: `AxiosAdapterConfig` \| `AxiosAdapterConfig`[]

Defined in: node\_modules/axios/index.d.ts:319

#### Inherited from

`AxiosRequestConfig.adapter`

***

### auth?

> `optional` **auth?**: `AxiosBasicCredentials`

Defined in: node\_modules/axios/index.d.ts:320

#### Inherited from

`AxiosRequestConfig.auth`

***

### baseURL?

> `optional` **baseURL?**: `string`

Defined in: node\_modules/axios/index.d.ts:309

#### Inherited from

`AxiosRequestConfig.baseURL`

***

### beforeRedirect?

> `optional` **beforeRedirect?**: (`options`, `responseDetails`) => `void`

Defined in: node\_modules/axios/index.d.ts:332

#### Parameters

##### options

`Record`\<`string`, `any`\>

##### responseDetails

###### headers

`Record`\<`string`, `string`\>

#### Returns

`void`

#### Inherited from

`AxiosRequestConfig.beforeRedirect`

***

### cancelToken?

> `optional` **cancelToken?**: `CancelToken`

Defined in: node\_modules/axios/index.d.ts:337

#### Inherited from

`AxiosRequestConfig.cancelToken`

***

### data?

> `optional` **data?**: `any`

Defined in: node\_modules/axios/index.d.ts:315

#### Inherited from

`AxiosRequestConfig.data`

***

### decompress?

> `optional` **decompress?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:338

#### Inherited from

`AxiosRequestConfig.decompress`

***

### env?

> `optional` **env?**: `object`

Defined in: node\_modules/axios/index.d.ts:342

#### FormData?

> `optional` **FormData?**: (...`args`) => `object`

##### Parameters

###### args

...`any`[]

##### Returns

`object`

#### Inherited from

`AxiosRequestConfig.env`

***

### formSerializer?

> `optional` **formSerializer?**: `FormSerializerOptions`

Defined in: node\_modules/axios/index.d.ts:345

#### Inherited from

`AxiosRequestConfig.formSerializer`

***

### headers?

> `optional` **headers?**: `AxiosHeaders` \| `Partial`\<`RawAxiosHeaders` & `object` & `object`\> & `Partial`\<`object` & `object`\>

Defined in: node\_modules/axios/index.d.ts:312

#### Inherited from

`AxiosRequestConfig.headers`

***

### httpAgent?

> `optional` **httpAgent?**: `any`

Defined in: node\_modules/axios/index.d.ts:334

#### Inherited from

`AxiosRequestConfig.httpAgent`

***

### httpsAgent?

> `optional` **httpsAgent?**: `any`

Defined in: node\_modules/axios/index.d.ts:335

#### Inherited from

`AxiosRequestConfig.httpsAgent`

***

### insecureHTTPParser?

> `optional` **insecureHTTPParser?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:341

#### Inherited from

`AxiosRequestConfig.insecureHTTPParser`

***

### maxBodyLength?

> `optional` **maxBodyLength?**: `number`

Defined in: node\_modules/axios/index.d.ts:329

#### Inherited from

`AxiosRequestConfig.maxBodyLength`

***

### maxContentLength?

> `optional` **maxContentLength?**: `number`

Defined in: node\_modules/axios/index.d.ts:327

#### Inherited from

`AxiosRequestConfig.maxContentLength`

***

### maxRate?

> `optional` **maxRate?**: `number` \| \[`number`, `number`\]

Defined in: node\_modules/axios/index.d.ts:331

#### Inherited from

`AxiosRequestConfig.maxRate`

***

### maxRedirects?

> `optional` **maxRedirects?**: `number`

Defined in: node\_modules/axios/index.d.ts:330

#### Inherited from

`AxiosRequestConfig.maxRedirects`

***

### method?

> `optional` **method?**: `string`

Defined in: node\_modules/axios/index.d.ts:308

#### Inherited from

`AxiosRequestConfig.method`

***

### onDownloadProgress?

> `optional` **onDownloadProgress?**: (`progressEvent`) => `void`

Defined in: node\_modules/axios/index.d.ts:326

#### Parameters

##### progressEvent

`AxiosProgressEvent`

#### Returns

`void`

#### Inherited from

`AxiosRequestConfig.onDownloadProgress`

***

### onUploadProgress?

> `optional` **onUploadProgress?**: (`progressEvent`) => `void`

Defined in: node\_modules/axios/index.d.ts:325

#### Parameters

##### progressEvent

`AxiosProgressEvent`

#### Returns

`void`

#### Inherited from

`AxiosRequestConfig.onUploadProgress`

***

### params?

> `optional` **params?**: `any`

Defined in: node\_modules/axios/index.d.ts:313

#### Inherited from

`AxiosRequestConfig.params`

***

### paramsSerializer?

> `optional` **paramsSerializer?**: `ParamsSerializerOptions`

Defined in: node\_modules/axios/index.d.ts:314

#### Inherited from

`AxiosRequestConfig.paramsSerializer`

***

### proxy?

> `optional` **proxy?**: `false` \| `AxiosProxyConfig`

Defined in: node\_modules/axios/index.d.ts:336

#### Inherited from

`AxiosRequestConfig.proxy`

***

### responseEncoding?

> `optional` **responseEncoding?**: `string`

Defined in: node\_modules/axios/index.d.ts:322

#### Inherited from

`AxiosRequestConfig.responseEncoding`

***

### responseType?

> `optional` **responseType?**: `ResponseType`

Defined in: node\_modules/axios/index.d.ts:321

#### Inherited from

`AxiosRequestConfig.responseType`

***

### signal?

> `optional` **signal?**: `GenericAbortSignal`

Defined in: node\_modules/axios/index.d.ts:340

#### Inherited from

`AxiosRequestConfig.signal`

***

### socketPath?

> `optional` **socketPath?**: `string` \| `null`

Defined in: node\_modules/axios/index.d.ts:333

#### Inherited from

`AxiosRequestConfig.socketPath`

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: node\_modules/axios/index.d.ts:316

#### Inherited from

`AxiosRequestConfig.timeout`

***

### timeoutErrorMessage?

> `optional` **timeoutErrorMessage?**: `string`

Defined in: node\_modules/axios/index.d.ts:317

#### Inherited from

`AxiosRequestConfig.timeoutErrorMessage`

***

### transformRequest?

> `optional` **transformRequest?**: `AxiosRequestTransformer` \| `AxiosRequestTransformer`[]

Defined in: node\_modules/axios/index.d.ts:310

#### Inherited from

`AxiosRequestConfig.transformRequest`

***

### transformResponse?

> `optional` **transformResponse?**: `AxiosResponseTransformer` \| `AxiosResponseTransformer`[]

Defined in: node\_modules/axios/index.d.ts:311

#### Inherited from

`AxiosRequestConfig.transformResponse`

***

### transitional?

> `optional` **transitional?**: `TransitionalOptions`

Defined in: node\_modules/axios/index.d.ts:339

#### Inherited from

`AxiosRequestConfig.transitional`

***

### url?

> `optional` **url?**: `string`

Defined in: node\_modules/axios/index.d.ts:307

#### Inherited from

`AxiosRequestConfig.url`

***

### validateStatus?

> `optional` **validateStatus?**: ((`status`) => `boolean`) \| `null`

Defined in: node\_modules/axios/index.d.ts:328

#### Inherited from

`AxiosRequestConfig.validateStatus`

***

### withCredentials?

> `optional` **withCredentials?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:318

#### Inherited from

`AxiosRequestConfig.withCredentials`

***

### xsrfCookieName?

> `optional` **xsrfCookieName?**: `string`

Defined in: node\_modules/axios/index.d.ts:323

#### Inherited from

`AxiosRequestConfig.xsrfCookieName`

***

### xsrfHeaderName?

> `optional` **xsrfHeaderName?**: `string`

Defined in: node\_modules/axios/index.d.ts:324

#### Inherited from

`AxiosRequestConfig.xsrfHeaderName`

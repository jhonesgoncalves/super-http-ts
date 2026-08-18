[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / CreateClientOptions

# Interface: CreateClientOptions

Defined in: [src/presets/index.ts:20](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/presets/index.ts#L20)

Options for [createClient](../functions/createClient.md).

## Extends

- [`HttpClientRequestConfig`](HttpClientRequestConfig.md)

## Properties

### adapter?

> `optional` **adapter?**: `AxiosAdapterConfig` \| `AxiosAdapterConfig`[]

Defined in: node\_modules/axios/index.d.ts:403

#### Inherited from

`CreateClientOptions`.[`adapter`](#adapter)

***

### allowAbsoluteUrls?

> `optional` **allowAbsoluteUrls?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:391

#### Inherited from

`CreateClientOptions`.[`allowAbsoluteUrls`](#allowabsoluteurls)

***

### allowedSocketPaths?

> `optional` **allowedSocketPaths?**: `string` \| `string`[] \| `null`

Defined in: node\_modules/axios/index.d.ts:429

#### Inherited from

`CreateClientOptions`.[`allowedSocketPaths`](#allowedsocketpaths)

***

### auth?

> `optional` **auth?**: `AxiosBasicCredentials`

Defined in: node\_modules/axios/index.d.ts:404

#### Inherited from

`CreateClientOptions`.[`auth`](#auth)

***

### baseURL

> **baseURL**: `string`

Defined in: [src/presets/index.ts:22](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/presets/index.ts#L22)

Base URL prepended to every request.

#### Overrides

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`baseURL`](HttpClientRequestConfig.md#baseurl)

***

### beforeRedirect?

> `optional` **beforeRedirect?**: (`options`, `responseDetails`, `requestDetails`) => `void`

Defined in: node\_modules/axios/index.d.ts:416

#### Parameters

##### options

`Record`\<`string`, `any`\>

##### responseDetails

###### headers

`Record`\<`string`, `string`\>

###### statusCode

`HttpStatusCode`

##### requestDetails

###### headers

`Record`\<`string`, `string`\>

###### method

`string`

###### url

`string`

#### Returns

`void`

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`beforeRedirect`](HttpClientRequestConfig.md#beforeredirect)

***

### cancelToken?

> `optional` **cancelToken?**: `CancelToken`

Defined in: node\_modules/axios/index.d.ts:434

#### Inherited from

`CreateClientOptions`.[`cancelToken`](#canceltoken)

***

### data?

> `optional` **data?**: `any`

Defined in: node\_modules/axios/index.d.ts:399

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`data`](HttpClientRequestConfig.md#data)

***

### decompress?

> `optional` **decompress?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:435

#### Inherited from

`CreateClientOptions`.[`decompress`](#decompress)

***

### env?

> `optional` **env?**: `object`

Defined in: node\_modules/axios/index.d.ts:439

#### fetch?

> `optional` **fetch?**: (`input`, `init?`) => `Promise`\<`Response`\>

##### Parameters

###### input

`string` \| `URL` \| `Request`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

#### FormData?

> `optional` **FormData?**: (...`args`) => `object`

##### Parameters

###### args

...`any`[]

##### Returns

`object`

#### Request?

> `optional` **Request?**: (`input`, `init?`) => `Request`

##### Parameters

###### input

`string` \| `URL` \| `Request`

###### init?

`RequestInit`

##### Returns

`Request`

#### Response?

> `optional` **Response?**: (`body?`, `init?`) => `Response`

##### Parameters

###### body?

`string` \| `URLSearchParams` \| `ArrayBuffer` \| `ArrayBufferView` \| `Blob` \| `FormData` \| `null`

###### init?

`ResponseInit`

##### Returns

`Response`

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`env`](HttpClientRequestConfig.md#env)

***

### family?

> `optional` **family?**: `AddressFamily`

Defined in: node\_modules/axios/index.d.ts:449

#### Inherited from

`CreateClientOptions`.[`family`](#family)

***

### fetchOptions?

> `optional` **fetchOptions?**: `Record`\<`string`, `any`\> \| `Omit`\<`RequestInit`, `"signal"` \| `"headers"` \| `"method"` \| `"body"`\>

Defined in: node\_modules/axios/index.d.ts:468

#### Inherited from

`CreateClientOptions`.[`fetchOptions`](#fetchoptions)

***

### formDataHeaderPolicy?

> `optional` **formDataHeaderPolicy?**: `"legacy"` \| `"content-only"`

Defined in: node\_modules/axios/index.d.ts:473

#### Inherited from

`CreateClientOptions`.[`formDataHeaderPolicy`](#formdataheaderpolicy)

***

### formSerializer?

> `optional` **formSerializer?**: `FormSerializerOptions`

Defined in: node\_modules/axios/index.d.ts:448

#### Inherited from

`CreateClientOptions`.[`formSerializer`](#formserializer)

***

### headers?

> `optional` **headers?**: `AxiosHeaders` \| `Partial`\<`RawAxiosHeaders` & `object` & `object`\> & `Partial`\<`object` & `object`\>

Defined in: node\_modules/axios/index.d.ts:394

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`headers`](HttpClientRequestConfig.md#headers)

***

### http2Options?

> `optional` **http2Options?**: `Record`\<`string`, `any`\> & `object`

Defined in: node\_modules/axios/index.d.ts:470

#### Type Declaration

##### sessionTimeout?

> `optional` **sessionTimeout?**: `number`

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`http2Options`](HttpClientRequestConfig.md#http2options)

***

### httpAgent?

> `optional` **httpAgent?**: `any`

Defined in: node\_modules/axios/index.d.ts:431

#### Inherited from

`CreateClientOptions`.[`httpAgent`](#httpagent)

***

### httpsAgent?

> `optional` **httpsAgent?**: `any`

Defined in: node\_modules/axios/index.d.ts:432

#### Inherited from

`CreateClientOptions`.[`httpsAgent`](#httpsagent)

***

### httpVersion?

> `optional` **httpVersion?**: `1` \| `2`

Defined in: node\_modules/axios/index.d.ts:469

#### Inherited from

`CreateClientOptions`.[`httpVersion`](#httpversion)

***

### insecureHTTPParser?

> `optional` **insecureHTTPParser?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:438

#### Inherited from

`CreateClientOptions`.[`insecureHTTPParser`](#insecurehttpparser)

***

### lookup?

> `optional` **lookup?**: ((`hostname`, `options`, `cb`) => `void`) \| ((`hostname`, `options`) => `Promise`\<`LookupAddress` \| \[`LookupAddressEntry` \| `LookupAddressEntry`[], `AddressFamily`\]\>)

Defined in: node\_modules/axios/index.d.ts:450

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`lookup`](HttpClientRequestConfig.md#lookup)

***

### maxBodyLength?

> `optional` **maxBodyLength?**: `number`

Defined in: node\_modules/axios/index.d.ts:413

#### Inherited from

`CreateClientOptions`.[`maxBodyLength`](#maxbodylength)

***

### maxContentLength?

> `optional` **maxContentLength?**: `number`

Defined in: node\_modules/axios/index.d.ts:411

#### Inherited from

`CreateClientOptions`.[`maxContentLength`](#maxcontentlength)

***

### maxRate?

> `optional` **maxRate?**: `number` \| \[`number`, `number`\]

Defined in: node\_modules/axios/index.d.ts:415

#### Inherited from

`CreateClientOptions`.[`maxRate`](#maxrate)

***

### maxRedirects?

> `optional` **maxRedirects?**: `number`

Defined in: node\_modules/axios/index.d.ts:414

#### Inherited from

`CreateClientOptions`.[`maxRedirects`](#maxredirects)

***

### method?

> `optional` **method?**: `StringLiteralsOrString`\<`Method`\>

Defined in: node\_modules/axios/index.d.ts:389

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`method`](HttpClientRequestConfig.md#method)

***

### onDownloadProgress?

> `optional` **onDownloadProgress?**: (`progressEvent`) => `void`

Defined in: node\_modules/axios/index.d.ts:410

#### Parameters

##### progressEvent

`AxiosProgressEvent`

#### Returns

`void`

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`onDownloadProgress`](HttpClientRequestConfig.md#ondownloadprogress)

***

### onUploadProgress?

> `optional` **onUploadProgress?**: (`progressEvent`) => `void`

Defined in: node\_modules/axios/index.d.ts:409

#### Parameters

##### progressEvent

`AxiosProgressEvent`

#### Returns

`void`

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`onUploadProgress`](HttpClientRequestConfig.md#onuploadprogress)

***

### params?

> `optional` **params?**: `any`

Defined in: node\_modules/axios/index.d.ts:395

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`params`](HttpClientRequestConfig.md#params)

***

### paramsSerializer?

> `optional` **paramsSerializer?**: `ParamsSerializerOptions`\<`Record`\<`string`, `any`\>\> \| `CustomParamsSerializer`\<`Record`\<`string`, `any`\>\>

Defined in: node\_modules/axios/index.d.ts:396

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`paramsSerializer`](HttpClientRequestConfig.md#paramsserializer)

***

### parseReviver?

> `optional` **parseReviver?**: (`this`, `key`, `value`, `context?`) => `any`

Defined in: node\_modules/axios/index.d.ts:467

#### Parameters

##### this

`any`

##### key

`string`

##### value

`any`

##### context?

###### source?

`string`

#### Returns

`any`

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`parseReviver`](HttpClientRequestConfig.md#parsereviver)

***

### pool?

> `optional` **pool?**: [`PoolConfig`](PoolConfig.md)

Defined in: [src/presets/index.ts:34](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/presets/index.ts#L34)

Connection pool options (merged with preset defaults when preset is set).

***

### preset?

> `optional` **preset?**: [`Preset`](../type-aliases/Preset.md)

Defined in: [src/presets/index.ts:31](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/presets/index.ts#L31)

Apply a built-in resilience preset.

You can override any preset setting by passing additional options.
Individual calls to `.retry()`, `.circuitBreak()` etc. always take
precedence over the preset.

***

### proxy?

> `optional` **proxy?**: `false` \| `AxiosProxyConfig`

Defined in: node\_modules/axios/index.d.ts:433

#### Inherited from

`CreateClientOptions`.[`proxy`](#proxy)

***

### redact?

> `optional` **redact?**: `string`[]

Defined in: node\_modules/axios/index.d.ts:474

#### Inherited from

`CreateClientOptions`.[`redact`](#redact)

***

### responseEncoding?

> `optional` **responseEncoding?**: `StringLiteralsOrString`\<`responseEncoding`\>

Defined in: node\_modules/axios/index.d.ts:406

#### Inherited from

`CreateClientOptions`.[`responseEncoding`](#responseencoding)

***

### responseType?

> `optional` **responseType?**: `ResponseType`

Defined in: node\_modules/axios/index.d.ts:405

#### Inherited from

`CreateClientOptions`.[`responseType`](#responsetype)

***

### sensitiveHeaders?

> `optional` **sensitiveHeaders?**: `string`[]

Defined in: node\_modules/axios/index.d.ts:475

#### Inherited from

`CreateClientOptions`.[`sensitiveHeaders`](#sensitiveheaders)

***

### signal?

> `optional` **signal?**: `GenericAbortSignal`

Defined in: node\_modules/axios/index.d.ts:437

#### Inherited from

`CreateClientOptions`.[`signal`](#signal)

***

### socketPath?

> `optional` **socketPath?**: `string` \| `null`

Defined in: node\_modules/axios/index.d.ts:428

#### Inherited from

`CreateClientOptions`.[`socketPath`](#socketpath)

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: node\_modules/axios/index.d.ts:400

#### Inherited from

`CreateClientOptions`.[`timeout`](#timeout)

***

### timeoutErrorMessage?

> `optional` **timeoutErrorMessage?**: `string`

Defined in: node\_modules/axios/index.d.ts:401

#### Inherited from

`CreateClientOptions`.[`timeoutErrorMessage`](#timeouterrormessage)

***

### transformRequest?

> `optional` **transformRequest?**: `AxiosRequestTransformer` \| `AxiosRequestTransformer`[]

Defined in: node\_modules/axios/index.d.ts:392

#### Inherited from

`CreateClientOptions`.[`transformRequest`](#transformrequest)

***

### transformResponse?

> `optional` **transformResponse?**: `AxiosResponseTransformer` \| `AxiosResponseTransformer`[]

Defined in: node\_modules/axios/index.d.ts:393

#### Inherited from

`CreateClientOptions`.[`transformResponse`](#transformresponse)

***

### transitional?

> `optional` **transitional?**: `TransitionalOptions`

Defined in: node\_modules/axios/index.d.ts:436

#### Inherited from

`CreateClientOptions`.[`transitional`](#transitional)

***

### transport?

> `optional` **transport?**: `any`

Defined in: node\_modules/axios/index.d.ts:430

#### Inherited from

`CreateClientOptions`.[`transport`](#transport)

***

### url?

> `optional` **url?**: `string`

Defined in: node\_modules/axios/index.d.ts:388

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`url`](HttpClientRequestConfig.md#url)

***

### validateStatus?

> `optional` **validateStatus?**: ((`status`) => `boolean`) \| `null`

Defined in: node\_modules/axios/index.d.ts:412

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`validateStatus`](HttpClientRequestConfig.md#validatestatus)

***

### withCredentials?

> `optional` **withCredentials?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:402

#### Inherited from

`CreateClientOptions`.[`withCredentials`](#withcredentials)

***

### withXSRFToken?

> `optional` **withXSRFToken?**: `boolean` \| ((`config`) => `boolean` \| `undefined`)

Defined in: node\_modules/axios/index.d.ts:466

#### Inherited from

[`HttpClientRequestConfig`](HttpClientRequestConfig.md).[`withXSRFToken`](HttpClientRequestConfig.md#withxsrftoken)

***

### xsrfCookieName?

> `optional` **xsrfCookieName?**: `string`

Defined in: node\_modules/axios/index.d.ts:407

#### Inherited from

`CreateClientOptions`.[`xsrfCookieName`](#xsrfcookiename)

***

### xsrfHeaderName?

> `optional` **xsrfHeaderName?**: `string`

Defined in: node\_modules/axios/index.d.ts:408

#### Inherited from

`CreateClientOptions`.[`xsrfHeaderName`](#xsrfheadername)

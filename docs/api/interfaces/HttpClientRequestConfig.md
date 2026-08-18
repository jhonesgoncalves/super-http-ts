[**super-http v2.0.0**](../README.md)

***

[super-http](../README.md) / HttpClientRequestConfig

# Interface: HttpClientRequestConfig

Defined in: [src/models/http.client.request.config.ts:4](https://github.com/jhonesgoncalves/super-http-ts/blob/df39290716f9e9c40e4da356234807897cab679c/src/models/http.client.request.config.ts#L4)

## Extends

- `AxiosRequestConfig`

## Extended by

- [`CreateClientOptions`](CreateClientOptions.md)

## Properties

### adapter?

> `optional` **adapter?**: `AxiosAdapterConfig` \| `AxiosAdapterConfig`[]

Defined in: node\_modules/axios/index.d.ts:403

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`adapter`](CreateClientOptions.md#adapter)

***

### allowAbsoluteUrls?

> `optional` **allowAbsoluteUrls?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:391

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`allowAbsoluteUrls`](CreateClientOptions.md#allowabsoluteurls)

***

### allowedSocketPaths?

> `optional` **allowedSocketPaths?**: `string` \| `string`[] \| `null`

Defined in: node\_modules/axios/index.d.ts:429

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`allowedSocketPaths`](CreateClientOptions.md#allowedsocketpaths)

***

### auth?

> `optional` **auth?**: `AxiosBasicCredentials`

Defined in: node\_modules/axios/index.d.ts:404

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`auth`](CreateClientOptions.md#auth)

***

### baseURL?

> `optional` **baseURL?**: `string`

Defined in: node\_modules/axios/index.d.ts:390

#### Inherited from

`AxiosRequestConfig.baseURL`

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

`AxiosRequestConfig.beforeRedirect`

***

### cancelToken?

> `optional` **cancelToken?**: `CancelToken`

Defined in: node\_modules/axios/index.d.ts:434

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`cancelToken`](CreateClientOptions.md#canceltoken)

***

### data?

> `optional` **data?**: `any`

Defined in: node\_modules/axios/index.d.ts:399

#### Inherited from

`AxiosRequestConfig.data`

***

### decompress?

> `optional` **decompress?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:435

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`decompress`](CreateClientOptions.md#decompress)

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

`AxiosRequestConfig.env`

***

### family?

> `optional` **family?**: `AddressFamily`

Defined in: node\_modules/axios/index.d.ts:449

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`family`](CreateClientOptions.md#family)

***

### fetchOptions?

> `optional` **fetchOptions?**: `Record`\<`string`, `any`\> \| `Omit`\<`RequestInit`, `"signal"` \| `"headers"` \| `"method"` \| `"body"`\>

Defined in: node\_modules/axios/index.d.ts:468

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`fetchOptions`](CreateClientOptions.md#fetchoptions)

***

### formDataHeaderPolicy?

> `optional` **formDataHeaderPolicy?**: `"legacy"` \| `"content-only"`

Defined in: node\_modules/axios/index.d.ts:473

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`formDataHeaderPolicy`](CreateClientOptions.md#formdataheaderpolicy)

***

### formSerializer?

> `optional` **formSerializer?**: `FormSerializerOptions`

Defined in: node\_modules/axios/index.d.ts:448

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`formSerializer`](CreateClientOptions.md#formserializer)

***

### headers?

> `optional` **headers?**: `AxiosHeaders` \| `Partial`\<`RawAxiosHeaders` & `object` & `object`\> & `Partial`\<`object` & `object`\>

Defined in: node\_modules/axios/index.d.ts:394

#### Inherited from

`AxiosRequestConfig.headers`

***

### http2Options?

> `optional` **http2Options?**: `Record`\<`string`, `any`\> & `object`

Defined in: node\_modules/axios/index.d.ts:470

#### Type Declaration

##### sessionTimeout?

> `optional` **sessionTimeout?**: `number`

#### Inherited from

`AxiosRequestConfig.http2Options`

***

### httpAgent?

> `optional` **httpAgent?**: `any`

Defined in: node\_modules/axios/index.d.ts:431

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`httpAgent`](CreateClientOptions.md#httpagent)

***

### httpsAgent?

> `optional` **httpsAgent?**: `any`

Defined in: node\_modules/axios/index.d.ts:432

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`httpsAgent`](CreateClientOptions.md#httpsagent)

***

### httpVersion?

> `optional` **httpVersion?**: `1` \| `2`

Defined in: node\_modules/axios/index.d.ts:469

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`httpVersion`](CreateClientOptions.md#httpversion)

***

### insecureHTTPParser?

> `optional` **insecureHTTPParser?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:438

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`insecureHTTPParser`](CreateClientOptions.md#insecurehttpparser)

***

### lookup?

> `optional` **lookup?**: ((`hostname`, `options`, `cb`) => `void`) \| ((`hostname`, `options`) => `Promise`\<`LookupAddress` \| \[`LookupAddressEntry` \| `LookupAddressEntry`[], `AddressFamily`\]\>)

Defined in: node\_modules/axios/index.d.ts:450

#### Inherited from

`AxiosRequestConfig.lookup`

***

### maxBodyLength?

> `optional` **maxBodyLength?**: `number`

Defined in: node\_modules/axios/index.d.ts:413

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`maxBodyLength`](CreateClientOptions.md#maxbodylength)

***

### maxContentLength?

> `optional` **maxContentLength?**: `number`

Defined in: node\_modules/axios/index.d.ts:411

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`maxContentLength`](CreateClientOptions.md#maxcontentlength)

***

### maxRate?

> `optional` **maxRate?**: `number` \| \[`number`, `number`\]

Defined in: node\_modules/axios/index.d.ts:415

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`maxRate`](CreateClientOptions.md#maxrate)

***

### maxRedirects?

> `optional` **maxRedirects?**: `number`

Defined in: node\_modules/axios/index.d.ts:414

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`maxRedirects`](CreateClientOptions.md#maxredirects)

***

### method?

> `optional` **method?**: `StringLiteralsOrString`\<`Method`\>

Defined in: node\_modules/axios/index.d.ts:389

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`method`](CreateClientOptions.md#method)

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

`AxiosRequestConfig.onDownloadProgress`

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

`AxiosRequestConfig.onUploadProgress`

***

### params?

> `optional` **params?**: `any`

Defined in: node\_modules/axios/index.d.ts:395

#### Inherited from

`AxiosRequestConfig.params`

***

### paramsSerializer?

> `optional` **paramsSerializer?**: `ParamsSerializerOptions`\<`Record`\<`string`, `any`\>\> \| `CustomParamsSerializer`\<`Record`\<`string`, `any`\>\>

Defined in: node\_modules/axios/index.d.ts:396

#### Inherited from

`AxiosRequestConfig.paramsSerializer`

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

`AxiosRequestConfig.parseReviver`

***

### proxy?

> `optional` **proxy?**: `false` \| `AxiosProxyConfig`

Defined in: node\_modules/axios/index.d.ts:433

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`proxy`](CreateClientOptions.md#proxy)

***

### redact?

> `optional` **redact?**: `string`[]

Defined in: node\_modules/axios/index.d.ts:474

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`redact`](CreateClientOptions.md#redact)

***

### responseEncoding?

> `optional` **responseEncoding?**: `StringLiteralsOrString`\<`responseEncoding`\>

Defined in: node\_modules/axios/index.d.ts:406

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`responseEncoding`](CreateClientOptions.md#responseencoding)

***

### responseType?

> `optional` **responseType?**: `ResponseType`

Defined in: node\_modules/axios/index.d.ts:405

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`responseType`](CreateClientOptions.md#responsetype)

***

### sensitiveHeaders?

> `optional` **sensitiveHeaders?**: `string`[]

Defined in: node\_modules/axios/index.d.ts:475

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`sensitiveHeaders`](CreateClientOptions.md#sensitiveheaders)

***

### signal?

> `optional` **signal?**: `GenericAbortSignal`

Defined in: node\_modules/axios/index.d.ts:437

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`signal`](CreateClientOptions.md#signal)

***

### socketPath?

> `optional` **socketPath?**: `string` \| `null`

Defined in: node\_modules/axios/index.d.ts:428

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`socketPath`](CreateClientOptions.md#socketpath)

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: node\_modules/axios/index.d.ts:400

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`timeout`](CreateClientOptions.md#timeout)

***

### timeoutErrorMessage?

> `optional` **timeoutErrorMessage?**: `string`

Defined in: node\_modules/axios/index.d.ts:401

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`timeoutErrorMessage`](CreateClientOptions.md#timeouterrormessage)

***

### transformRequest?

> `optional` **transformRequest?**: `AxiosRequestTransformer` \| `AxiosRequestTransformer`[]

Defined in: node\_modules/axios/index.d.ts:392

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`transformRequest`](CreateClientOptions.md#transformrequest)

***

### transformResponse?

> `optional` **transformResponse?**: `AxiosResponseTransformer` \| `AxiosResponseTransformer`[]

Defined in: node\_modules/axios/index.d.ts:393

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`transformResponse`](CreateClientOptions.md#transformresponse)

***

### transitional?

> `optional` **transitional?**: `TransitionalOptions`

Defined in: node\_modules/axios/index.d.ts:436

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`transitional`](CreateClientOptions.md#transitional)

***

### transport?

> `optional` **transport?**: `any`

Defined in: node\_modules/axios/index.d.ts:430

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`transport`](CreateClientOptions.md#transport)

***

### url?

> `optional` **url?**: `string`

Defined in: node\_modules/axios/index.d.ts:388

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`url`](CreateClientOptions.md#url)

***

### validateStatus?

> `optional` **validateStatus?**: ((`status`) => `boolean`) \| `null`

Defined in: node\_modules/axios/index.d.ts:412

#### Inherited from

`AxiosRequestConfig.validateStatus`

***

### withCredentials?

> `optional` **withCredentials?**: `boolean`

Defined in: node\_modules/axios/index.d.ts:402

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`withCredentials`](CreateClientOptions.md#withcredentials)

***

### withXSRFToken?

> `optional` **withXSRFToken?**: `boolean` \| ((`config`) => `boolean` \| `undefined`)

Defined in: node\_modules/axios/index.d.ts:466

#### Inherited from

`AxiosRequestConfig.withXSRFToken`

***

### xsrfCookieName?

> `optional` **xsrfCookieName?**: `string`

Defined in: node\_modules/axios/index.d.ts:407

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`xsrfCookieName`](CreateClientOptions.md#xsrfcookiename)

***

### xsrfHeaderName?

> `optional` **xsrfHeaderName?**: `string`

Defined in: node\_modules/axios/index.d.ts:408

#### Inherited from

[`CreateClientOptions`](CreateClientOptions.md).[`xsrfHeaderName`](CreateClientOptions.md#xsrfheadername)

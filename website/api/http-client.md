# HttpClient

The core HTTP client. Wraps Axios with connection pooling, retry, and circuit breaker.

Instantiate via [`HttpClientFactory.create()`](./http-client-factory) for singleton-per-baseURL behaviour.

---

## HTTP Methods

### `get<T>(url, config?)`

```typescript
get<T = any>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>>
```

```typescript
const { data } = await client.get<User[]>('/users')
```

---

### `post<T>(url, data?, config?)`

```typescript
post<T = any>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>>
```

```typescript
const { data } = await client.post<User>('/users', { name: 'Alice' })
```

---

### `put<T>(url, data?, config?)`

```typescript
put<T = any>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>>
```

---

### `patch<T>(url, data?, config?)`

```typescript
patch<T = any>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>>
```

---

### `delete<T>(url, config?)`

```typescript
delete<T = any>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>>
```

---

### `request<T>(config)`

```typescript
request<T = any>(config: AxiosRequestConfig): Promise<HttpClientResponse<T>>
```

Raw Axios request config. Prefer the typed convenience methods above.

---

## Fluent Configuration

### `retry(retries, delayMs, retryOn?)`

```typescript
retry(retries: number, delayMs: number, retryOn?: number[]): this
```

Enables automatic retry. Returns `this` for chaining.

| Parameter | Type | Description |
|---|---|---|
| `retries` | `number` | Max retry attempts |
| `delayMs` | `number` | Delay between attempts (ms) |
| `retryOn` | `number[]` | Optional: retry only on these status codes |

```typescript
client.retry(3, 500)
client.retry(3, 500, [429, 503])
```

---

### `circuitBreak(config)`

```typescript
circuitBreak(config: CircuitBreakerConfig): this
```

Enables the circuit breaker. Returns `this` for chaining.

```typescript
client.circuitBreak({
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 10_000,
})
```

---

## Chaining

```typescript
HttpClientFactory.create('https://api.example.com')
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 10_000 })
  .retry(3, 500)
  .get('/users')
```

# Migrating from Axios

super-http is a superset of Axios — every Axios feature works, and you add resilience on top. Migration is a drop-in replacement in most cases.

---

## Basic migration

::: code-group

```typescript [Before (axios)]
import axios from 'axios'

const res = await axios.get('https://api.example.com/users')
```

```typescript [After (super-http)]
import { createClient } from 'super-http'

const http = createClient({ baseURL: 'https://api.example.com' })
const res = await http.get('/users')
```

:::

---

## axios.create → createClient

::: code-group

```typescript [Before]
const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: { Authorization: `Bearer ${token}` },
})
```

```typescript [After]
import { createClient } from 'super-http'

const api = createClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: { Authorization: `Bearer ${token}` },
  // optional: add a preset for instant resilience
  preset: 'resilient-api',
})
```

:::

---

## Interceptors → Lifecycle hooks

::: code-group

```typescript [Before (axios interceptors)]
api.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = uuid()
  return config
})

api.interceptors.response.use(
  (res) => { logger.info(`← ${res.status}`) ; return res },
  (err) => { logger.error('request failed', err) ; return Promise.reject(err) },
)
```

```typescript [After (super-http hooks)]
api.on({
  onRequest:  (config)   => { config.headers!['X-Request-ID'] = uuid() },
  onResponse: (response) => logger.info(`← ${response.status}`),
  onError:    (error)    => logger.error('request failed', error),
})
```

:::

::: tip
Lifecycle hooks (`onRequest`, `onResponse`, `onError`) can also modify request config — return value is not needed, mutations are picked up automatically.
:::

---

## Manual retry → .retry()

::: code-group

```typescript [Before (manual)]
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url)
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(500)
    }
  }
}
```

```typescript [After]
import { createClient, ExponentialJitterRetryStrategy } from 'super-http'

const api = createClient({ baseURL: 'https://api.example.com' })
api.retry(3, new ExponentialJitterRetryStrategy(100, 5_000))

// That's it — retries happen automatically
const res = await api.get('/data')
```

:::

---

## Manual timeout → PoolConfig

::: code-group

```typescript [Before]
const res = await axios.get(url, { timeout: 5000 })
```

```typescript [After — client-level (applies to all requests)]
const api = createClient({
  baseURL: 'https://api.example.com',
  pool: { timeout: 5000 },
})
```

```typescript [After — per-request override]
const res = await api.get('/slow-endpoint', { policy: { timeout: 30_000 } })
```

:::

---

## Cancel tokens → AbortSignal

Axios cancel tokens are supported transparently. You can also use the standard `AbortSignal`:

```typescript
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)

await api.get('/data', { signal: controller.signal })
```

---

## Headers, params, auth — no changes

All Axios request config options work unchanged:

```typescript
await api.post('/users', payload, {
  params:  { locale: 'pt-BR' },
  headers: { 'X-Idempotency-Key': uuid() },
  auth:    { username: 'user', password: 'pass' },
})
```

---

## Upload / download progress

```typescript
await api.post('/upload', formData, {
  onUploadProgress: (e) => console.log(`${Math.round(e.progress! * 100)}%`),
})

await api.get('/file', {
  responseType: 'stream',
  onDownloadProgress: (e) => console.log(`${Math.round(e.progress! * 100)}%`),
})
```

---

## Migration checklist

- [ ] Replace `axios.create({ baseURL, ... })` with `createClient({ baseURL, ... })`
- [ ] Replace `axios.interceptors.request.use` with `client.on({ onRequest })`
- [ ] Replace `axios.interceptors.response.use` with `client.on({ onResponse, onError })`
- [ ] Replace manual retry loops with `client.retry(n, strategy)`
- [ ] Add a preset (optional but recommended): `preset: 'resilient-api'`
- [ ] Replace `import axios from 'axios'` with `import { createClient } from 'super-http'`

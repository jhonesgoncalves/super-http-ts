# Request Deduplication

Request deduplication coalesces **identical concurrent calls** into a single network request. All callers receive the same resolved (or rejected) response — zero wasted bandwidth.

---

## The problem

In a server-rendered or microservice environment, multiple parts of the code may request the same resource simultaneously — e.g. three components fetching `/users/me` during a single request lifecycle:

```
Without dedup:                With dedup:
  GET /users/me  ──► network    GET /users/me  ──► network
  GET /users/me  ──► network    GET /users/me  ──┘ (shared)
  GET /users/me  ──► network    GET /users/me  ──┘ (shared)
  3 network calls               1 network call ✓
```

---

## Usage

```typescript
client.dedup()
```

```typescript
// Three simultaneous calls → one HTTP request, three callers get the same result
const [a, b, c] = await Promise.all([
  client.get('/users/me'),
  client.get('/users/me'),
  client.get('/users/me'),
])
// a === b === c (same response object)
```

---

## How it works

Calls are keyed by `METHOD:URL:params`. While a request is in-flight, any new call with the same key reuses the existing `Promise`. Once the request settles (success or error), the entry is removed — the next call starts a fresh request.

---

## Important limitations

::: warning Only use for idempotent requests
Deduplication is designed for **GET** and **HEAD** requests. Do **not** use it for POST, PUT, PATCH, or DELETE — those are not idempotent and should never be coalesced.
:::

- Only `GET` and `HEAD` are coalesced by default. Other methods pass straight through, untouched.
- The request body **is** part of the key, so two concurrent writes with different payloads are never collapsed into one — but the method allowlist is the real protection, and you have to opt out of it deliberately:

```typescript
// Opt in at your own risk — only for an endpoint you know is idempotent
client.dedup({ methods: ['GET', 'HEAD', 'POST'] })
```

- A body that cannot be compared byte-for-byte (a stream, a `FormData`, a circular object) is never deduplicated. Skipping the optimisation costs one extra request; getting it wrong would hand one caller another caller's response.

---

## Combining with other features

```typescript
const resourceClient = HttpClientFactory.create('https://api.example.com')

resourceClient
  .retry(3, new ExponentialJitterRetryStrategy(100, 5_000))
  .dedup()  // coalesce concurrent reads before retry/circuit-breaker overhead

const { data: user } = await resourceClient.get('/users/me')
```

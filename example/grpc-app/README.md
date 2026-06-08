# super-http — gRPC Example

Complete working example of `super-http/grpc`: TypeScript-first gRPC with circuit breaker, retry, bulkhead, streaming and metrics — **no `.proto` files required**.

## What's included

| File | What it demonstrates |
|---|---|
| `src/services/definitions.ts` | Service contracts in pure TypeScript (`defineService`, `unary`, `serverStream`, `clientStream`, `bidi`) |
| `src/services/clients.ts` | Three client configurations: `resilient-api`, `high-throughput`, manual full config |
| `src/mock-server/index.ts` | Local Connect-RPC JSON server (HTTP/1.1) — no external dependencies |
| `src/demos/unary.ts` | Unary calls: getUser, createUser, placeOrder + error handling |
| `src/demos/streaming.ts` | All streaming types: server stream, client stream, bidi |
| `src/demos/resilience.ts` | Retry, circuit breaker, bulkhead, rate limiter, cancellation, per-call metadata |

## Services

```
UserService    — getUser (unary) · createUser (unary) · listUsers (server stream)
ProductService — getProduct (unary) · listProducts (server stream)
OrderService   — placeOrder (unary) · trackOrder (server stream)
LogService     — uploadLogs (client stream)
ChatService    — chat (bidi stream)
```

## Quick start

```bash
# Install deps (uses the local super-http build)
npm install

# Run all demos (starts mock server automatically)
npm run demo:all

# Or run individual demos
npm run demo:unary
npm run demo:streaming
npm run demo:resilience

# Start just the mock server (for external testing)
npm run mock-server
```

## Architecture

```
src/
├── services/
│   ├── definitions.ts   # Service contracts — the single source of truth
│   └── clients.ts       # Pre-configured gRPC clients
├── mock-server/
│   └── index.ts         # Local Connect-RPC JSON server (HTTP/1.1)
├── demos/
│   ├── unary.ts         # Demo 01 — unary calls
│   ├── streaming.ts     # Demo 02 — all streaming patterns
│   ├── resilience.ts    # Demo 03 — resilience pipeline
│   └── index.ts         # Demo runner (starts server + runs all)
└── main.ts              # Entry point
```

## Connecting to a real server

Change `GRPC_SERVER` env var to point at your server:

```bash
GRPC_SERVER=grpcs://your-service.example.com:443 npm run demo:unary
```

The clients use the Connect-RPC JSON protocol by default (`application/connect+json`).
To use standard gRPC wire format, set `protocol: 'grpc'` in the client config.

## Key concepts shown

### TypeScript-first service definition
```ts
const UserServiceDef = defineService('UserService', {
  getUser:   unary<{ id: string }, User>(),
  listUsers: serverStream<{ active?: boolean }, User>(),
})
```

### Resilience preset (zero config)
```ts
const client = createGrpcClient(UserServiceDef, address, {
  preset: 'resilient-api',  // circuit breaker + retry x3 + bulkhead
})
```

### Server streaming with backpressure
```ts
for await (const user of client.listUsers({ active: true })) {
  await processUser(user)  // consumer pace drives HTTP/2 flow control
}
```

### Error handling by status code
```ts
try {
  await client.getUser({ id: 'missing' })
} catch (err) {
  if (err instanceof GrpcError && err.code === 'not_found') return null
}
```

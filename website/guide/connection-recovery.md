# Connection lifecycle and recovery (2.1)

A healthy upstream can close a keep-alive connection while the client is about to
reuse it. `ECONNRESET` / `socket hang up` alone does not identify which peer closed
the connection, nor prove whether the request reached the application.

## Separate the time budgets

- `timeout` / `policy.timeout`: timeout for one HTTP attempt. A direct Axios
  `timeout` on `get()` is honoured; `policy.timeout` takes precedence.
- `.deadline(ms)` / `policy.deadlineMs`: total budget, including queue waits,
  retries and backoff. `timeout: 0` does not disable a configured deadline.
- `pool.socketTimeoutMs`: the native Agent's socket inactivity setting, retained
  for compatibility. It is not an independent connect-timeout guarantee: active
  requests also have Axios timeout/cancellation behaviour.
- `pool.freeSocketTimeoutMs`: an additional cap applied only while a connection
  is free in the pool. The smaller positive native timeout or server hint wins.
  `0` disables this additional cap, not native timeout protections.
- `pool.maxSocketAgeMs`: retire old connections when they become idle. Active
  requests are never interrupted merely because the connection is old.

`keepAliveMsecs` is the initial delay before TCP keep-alive probes, not an HTTP
idle TTL. TCP probes do not prevent a server, proxy or load balancer from closing
a connection under its own HTTP idle policy.

## Example: up to 4,000 calls per minute

```typescript
import { createClient, ExponentialJitterRetryStrategy } from 'super-http'

const members = createClient({
  baseURL: 'https://member-manager.example',
  isolated: true,
  timeout: 1_500,
  pool: {
    maxSockets: 32,
    maxFreeSockets: 8,
    scheduling: 'lifo',
    socketTimeoutMs: 4_000,
    freeSocketTimeoutMs: 4_000,
    keepAliveTimeoutBufferMs: 1_000,
    maxSocketAgeMs: 60_000,
  },
})
  .retry(1, new ExponentialJitterRetryStrategy(100, 150))
  .deadline(3_000)
  .bulkhead({ maxConcurrent: 32, maxQueue: 64, queueTimeoutMs: 200 })
  .correlate()

members.on({
  onAttemptError: ({ code, reusedSocket, attempt }) => {
    console.debug('HTTP attempt failed', { code, reusedSocket, attempt })
  },
  onRecovered: ({ attempts, elapsedMs }) => {
    console.info('HTTP call recovered', { attempts, elapsedMs })
  },
  onError: (error) => console.error('HTTP call ultimately failed', error),
})

const { data } = await members.get('/api/members/synthetic-member')
// On shutdown (automatic for injected Nest HTTP clients):
await members.close()
```

These are starting values for load testing, not universal production defaults.
4,000/min is about 67/s; at 200 ms average duration this is about 14 concurrent
calls before accounting for bursts and retries. All pool/bulkhead limits are per
client/process/destination; replica counts multiply the possible concurrency.

Only use a 4 s idle cap after confirming that it is below the smallest known MM,
proxy and load-balancer idle timeout, with margin. The 60 s connection age is an
optional example independent of that idle timeout; tune it to avoid needless
handshakes. `lifo` is already Node's default; setting it explicitly documents the
choice. A finite pool queues excess calls; a bulkhead and deadline bound that
waiting work.

If 4,000/min is a hard upstream quota, use a shared/distributed rate limiter or
partition the quota across clients and replicas, including retries. The built-in
rate limiter is local, fixed-window, and allows bursts; it is not a global or
rolling-window quota.

## Recovering a reused-socket reset

With retry enabled, 2.1 identifies `ECONNRESET` on a known reused socket (including
the native request inside `follow-redirects`). For an eligible method/body and
remaining retry budget, one recovery attempt uses private non-pooling Agents so
it cannot select another idle socket from the shared pool. It never clears or
destroys unrelated pooled connections.

That recovery consumes the existing retry count, rate-limit permit, bulkhead
admission and total deadline. It adds no hidden attempts. The initial eligible
reset is not counted by the circuit breaker when a recovery can be scheduled;
a failure of the fresh attempt counts normally. Other concurrent failures can
still open the shared circuit and prevent retry.

Disable the special fresh-connection/health treatment if required:

```typescript
members.retry(1, 100, { recoverReusedSocket: false })
```

Ordinary retry rules still apply after this opt-out. POST/PATCH resets remain
ambiguous and are not retried unless `retryNonIdempotent: true` is explicitly
chosen with an upstream idempotency guarantee. A request-id header alone does not
provide that guarantee. Stream request bodies are not automatically replayed.
Streaming responses keep the recovery connection alive until the stream closes.

## Observe attempts and final outcomes separately

`onRequest` and `onResponse` describe transport attempts. `onAttemptError` contains
`error`, `code`, `status`, optional `reusedSocket`, correlation `requestId`, the
one-based `attempt`, `elapsedMs`, and `remainingDeadlineMs` (Infinity without a
deadline). An unknown socket reuse flag is not evidence of a new connection.

`onError` fires once for a rejected logical operation, after retries and fallback.
A successful fallback emits `onFallback`, not `onError` or `onRecovered`.
`onRecovered` fires for a successful logical call with more than one transport
attempt. With deduplication, final rejection is reported to each caller; recovery events
and retry counters belong to the caller that dispatches the shared transport.

Use `metrics().recovered`, `attemptErrors`, `reusedSocketResets`, `newSocketResets`,
`unknownSocketResets`, `avgFailedLatency` and the existing final `failed` counter.
`state().pool.http` and `.https` report active/idle/queued counts for the owned
shared Agents (temporary one-shot recovery Agents are not included).

## Upgrade notes

- Integrations using `onError` for attempt logging must use `onAttemptError`.
  `onError` now matches its documented final-failure contract, including policy
  rejections before Axios is called.
- `HttpClientRequestConfig` now types `policy` directly; no `as never` is needed.
- `createClient({ isolated: true })` and `HttpClientFactory.createIsolated()` bypass
  the shared registry. Nest named clients use this path and do not clear other
  clients. Injected HTTP clients close on module destruction.
- `close()` is idempotent; calls on a closed client reject. A factory lookup
  replaces a previously closed cached instance. `clear()` closes only cached
  clients, not independently created clients.

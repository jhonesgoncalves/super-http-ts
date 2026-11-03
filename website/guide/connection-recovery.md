# Connection lifecycle and recovery

In **super-http 3.0**, select an HTTP preset to manage connections, time budgets,
circuit breaking and bounded admission together. `resilient-api` and
`high-throughput` also include safe retry and fresh-connection recovery. You do
not need to configure an Agent, retry decorator or bulkhead separately.

A healthy upstream can close a keep-alive connection just as the client tries to
reuse it. `ECONNRESET` / `socket hang up` alone does not identify which peer closed
the connection or prove whether the request reached the application. Recovery
reduces final failures from eligible transient faults; it cannot guarantee that
every connection error will disappear.

## Start with a preset

```typescript
import { createClient } from 'super-http'

const members = createClient({
  baseURL: 'https://member-manager.example',
  isolated: true,
  preset: 'resilient-api',
})

const { data } = await members.get('/api/members/synthetic-member')

// Keep one client for the integration; close it during application shutdown.
// Do not close it after each request.
// await members.close()
```

For a higher concurrency budget, select `high-throughput` instead. It includes
the same connection lifecycle protections and one safe additional retry. A larger
pool does not make socket recovery more effective; choose it for the concurrency
your application and upstream can sustain.

| Managed setting | `resilient-api` | `high-throughput` | `low-latency` |
|---|---:|---:|---:|
| Concurrent attempts / pool sockets | 32 | 128 | 32 |
| Idle reserve | 8 | 32 | 8 |
| Queue capacity / maximum wait | 64 / 200 ms | 256 / 100 ms | 64 / 25 ms |
| Attempt timeout | 1,500 ms | 2,000 ms | 500 ms |
| Total call deadline | 3,000 ms | 5,000 ms | 1,000 ms |
| Additional retries | 1 | 1 | 0 |
| Breaker open period | 5,000 ms | 5,000 ms | 2,000 ms |

All profiles include a circuit breaker and bulkhead. The breaker opens after 10
consecutive counted failures and closes after one successful probe following its
open period. HTTP 4xx responses do not count toward opening the circuit.
`low-latency` manages the pool but does **not** retry, so it does not perform a
fresh-connection recovery attempt after a reset.

All profiles also configure:

- Keep-alive with `lifo` selection, preferring recently used connections.
- A 4,000 ms additional idle cap; a tighter positive native timeout or upstream
  keep-alive hint wins.
- A 1,000 ms safety margin on an advertised upstream keep-alive timeout.
- A 60,000 ms maximum socket age, with retirement when the socket becomes idle.
  Active requests are not interrupted solely because a connection is old.

These settings are already in the preset. See [Managed presets](./presets) for
all defaults and overrides, or [Upgrading 2.x to 3.0](./migration-3) before migrating.

## Example workload: 4,000 calls per minute

4,000 logical calls/minute is about 67/s. At 200 ms average duration, that implies
about 14 concurrent calls before bursts and retries. Start with `resilient-api`'s
capacity of 32 and validate latency, final failures, connections and queue
rejections under load. This sizing is an estimate, not a throughput guarantee.

If measurement calls for a different budget, adjust one option rather than sizing
the pool and bulkhead independently:

```typescript
const members = createClient({
  baseURL: 'https://member-manager.example',
  isolated: true,
  preset: 'resilient-api',
  capacity: 64,       // optional: pool + admission sizing together
  deadlineMs: 3_000,  // optional: total logical-call budget
})
```

`capacity` is simultaneous attempts per client/process, not TPM/RPM. It derives
pool sockets, bulkhead concurrency, a queue twice that size and an idle reserve
of `ceil(capacity / 4)`. Replicas multiply the possible concurrency. Pool socket
limits apply per origin; the bulkhead bounds concurrent attempts for the client.

If 4,000/min is a hard upstream quota, use distributed admission or partition the
quota across clients and replicas, including retries. The built-in rate limiter
is local and fixed-window; a preset does not impose a global traffic quota.

## How a reused-socket reset recovers

When retry is enabled, the client identifies `ECONNRESET` on a known reused socket,
including the native request inside `follow-redirects`. For an eligible
method/body and remaining retry budget, a recovery attempt uses private,
non-pooling Agents so it cannot select another idle socket from the shared pool.
It never clears or destroys unrelated pooled connections.

Recovery consumes the existing retry count, bulkhead admission, total deadline
and a rate-limit permit if a limiter is configured. It adds no hidden attempts.
With either retry-enabled preset, the default is at most **two transport
attempts** for a logical call. Admission rejection, an open circuit or an expired
deadline can prevent the additional attempt.

The initial eligible reset is deferred from circuit-breaker counting when a
recovery can be scheduled. A failed fresh attempt counts normally. Other
concurrent failures can still open the shared circuit and prevent the retry.
Unknown socket reuse metadata is not evidence of a new or reused connection.

### Writes and request bodies

POST/PATCH resets, timeouts and 5xx responses are ambiguous: the server may
already have applied the operation. They are not retried unless
`retryNonIdempotent: true` is explicitly chosen with a verified upstream
idempotency contract. A request-id header alone does not provide that guarantee.
Connection failures proving no request was sent may still retry.

Stream request bodies are not automatically replayed. Streaming responses keep
the recovery connection alive until the stream closes; long-running streams need
application-appropriate time budgets.

### Advanced opt-out

Most integrations should keep the preset defaults. To disable the special
fresh-connection/health treatment while retaining ordinary retry rules:

```typescript
members.retry(1, 100, { recoverReusedSocket: false })
```

This overrides the preset's jitter strategy with a fixed delay. To disable all
retries instead, use `.retry(0, 0)`. Fluent policy changes should be made once at
client setup, before concurrent use.

## Time budgets and infrastructure overrides

Presets already configure these budgets. Override them only for a known latency
requirement or infrastructure constraint:

- `timeout`: per-attempt timeout; top-level configuration overrides the preset.
  A request-level `timeout` is honoured, and `policy.timeout` takes precedence.
  Legacy explicit `pool.timeout` still overrides the client's top-level default.
- `deadlineMs` / `.deadline(ms)` / `policy.deadlineMs`: total call budget,
  including queue waits, attempts and backoff. `timeout: 0` does not disable a
  configured deadline. Extending the attempt timeout does not extend the deadline.
- `pool.socketTimeoutMs`: native Agent socket inactivity setting. It is not an
  independent connect-timeout guarantee; active requests also have Axios
  timeout/cancellation behaviour.
- `pool.freeSocketTimeoutMs`: additional cap while a connection is free in the
  pool. `0` disables this cap, not the native timeout protections.
- `pool.maxSocketAgeMs`: retirement on return to idle after the configured age.

The preset honours advertised keep-alive hints automatically, but cannot discover
an unadvertised proxy or load-balancer idle timeout. If the infrastructure's
smallest idle limit is shorter, override `pool.freeSocketTimeoutMs` to stay below
it with margin. Tune socket age only when measurement justifies it.

`keepAliveMsecs` controls the initial delay before TCP keep-alive probes, not an
HTTP idle TTL. TCP probes do not prevent an HTTP server or intermediary from
closing an idle connection.

## Observe attempts and final outcomes separately

Connect these hooks to your existing telemetry; a preset does not install a logger
or alerts automatically:

```typescript
members.on({
  onAttemptError: ({ code, reusedSocket, attempt }) => {
    console.debug('MM attempt failed', { code, reusedSocket, attempt })
  },
  onRecovered: ({ attempts, elapsedMs }) => {
    console.info('MM call recovered', { attempts, elapsedMs })
  },
  onError: () => {
    console.error('MM call failed after resilience policies')
  },
})
```

`onRequest` and `onResponse` describe transport attempts. `onAttemptError` also
includes `error`, `status`, optional correlation `requestId`, one-based `attempt`,
`elapsedMs` and `remainingDeadlineMs` (Infinity without a deadline). Avoid logging
raw error/request objects, which can include credentials or personal data.

`onError` fires once for a rejected logical operation, after retries and fallback.
A successful fallback emits `onFallback`, not `onError` or `onRecovered`.
`onRecovered` fires for a successful logical call with multiple transport
attempts. With deduplication, final rejection is reported to each caller;
recovery events and retry counters belong to the caller dispatching the shared
transport. Avoid turning every recovered attempt into an availability alert.

Use `metrics().recovered`, `attemptErrors`, `reusedSocketResets`, `newSocketResets`,
`unknownSocketResets`, `avgFailedLatency` and the final `failed` counter.
`state().pool.http` and `.https` report active/idle/queued counts for the owned
shared Agents; temporary recovery Agents are not included.

## Application integration and lifecycle

Remove outer retry decorators or loops for the migrated MM calls so attempts do
not multiply. Preserve error mapping, business fallbacks and unrelated retry
utilities in the application. Evaluate the POST idempotency contract separately.

`createClient({ isolated: true })` and `HttpClientFactory.createIsolated()` bypass
the shared registry. Otherwise the first configuration for a URL wins: subsequent
lookups do not reset the breaker, replace the queue or reapply a preset. A closed
cached client is replaced on the next factory lookup.

Nest named HTTP clients are isolated and accept the same preset options.
Nest-injected HTTP clients close on module destruction. For independently owned
clients, call `close()` on application shutdown. Closing is idempotent; calls on a
closed client reject. `HttpClientFactory.clear()` closes cached clients only.

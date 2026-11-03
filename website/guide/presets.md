# Managed HTTP presets

Choose a profile; the client manages connection reuse, idle retirement, a total
call deadline, safe retry, a circuit breaker and bounded admission for you.
No preset is selected implicitly. These managed HTTP profiles are available in
**3.0.0**. See [Migrating from 2.x](./migration-3); gRPC presets are unchanged.

```typescript
import { createClient } from 'super-http'

const members = createClient({
  baseURL: 'https://members.example',
  preset: 'resilient-api',
  isolated: true,
})

const { data } = await members.get('/api/members/synthetic-member')
```

## Pick a profile

| Setting | `resilient-api` | `high-throughput` | `low-latency` |
|---|---:|---:|---:|
| Intended use | Critical service integrations | High-volume internal reads | Fast responses, fail quickly |
| Concurrent attempts / pool sockets | 32 | 128 | 32 |
| Idle reserve | 8 | 32 | 8 |
| Queued attempts | 64 | 256 | 64 |
| Queue wait cap | 200 ms | 100 ms | 25 ms |
| Attempt timeout | 1,500 ms | 2,000 ms | 500 ms |
| Total logical-call deadline | 3,000 ms | 5,000 ms | 1,000 ms |
| Additional retries | 1 | 1 | 0 |
| Full-jitter retry base / ceiling | 100 / 150 ms | 50 / 100 ms | Disabled |
| Breaker open period | 5,000 ms | 5,000 ms | 2,000 ms |

All three profiles use keep-alive, `lifo`, a 4,000 ms additional idle cap,
1,000 ms margin on an advertised upstream keep-alive timeout, and a 60,000 ms
socket age limit applied on return to idle. A tighter native timeout or upstream
hint wins. Active requests are not interrupted solely because a connection ages.
Unknown proxy/LB idle policies cannot be discovered automatically: override the
idle cap when your infrastructure requires a shorter one.

The circuit opens after 10 consecutive counted failures; after its open period,
one probe success closes it. The HTTP classifier excludes 4xx responses. The
breaker counts eligible failed attempts, not a rolling percentage of logical
calls. A recoverable known-reused reset scheduled for fresh-connection recovery
is deferred from the breaker count; a failed recovery counts normally.

## One capacity budget

```typescript
const catalog = createClient({
  baseURL: 'https://catalog.example',
  isolated: true,
  preset: 'high-throughput',
  capacity: 64,
  deadlineMs: 2_000,
})
```

`capacity` derives pool sockets and bulkhead concurrency together, a queue twice
that size, and an idle reserve of `ceil(capacity / 4)`. It is a positive integer
and requires a preset. It represents **simultaneous attempts per client/process**,
not RPM/TPM. It is explicit sizing, not an adaptive controller or an automatic
benchmark of your upstream. Replicas multiply the possible concurrency.

For a workload of 4,000 logical calls/minute (about 67/s), 200 ms average latency
implies about 14 concurrent calls before bursts/retries. Start with
`resilient-api`'s capacity 32 and validate against your actual latency, replicas
and upstream capacity. For a hard global quota, use distributed admission that
also counts retries; the built-in local rate limiter is not a global quota.

## Safety without per-request retry boilerplate

GET and other eligible idempotent methods may retry transient failures. A known
reused socket reset can recover using a new connection, within the same retry
budget and deadline. Streaming bodies are not automatically replayed.

POST/PATCH are not replayed after ambiguous resets, timeouts or 5xx responses.
Connection failures proving no request was sent may still retry. Enable
`retryNonIdempotent` only with a verified upstream idempotency contract.
`low-latency` never retries, including socket recovery.

Keep fallbacks and business decisions in the application. Observe
`onAttemptError`, `onRecovered`, `onError` and `state()`/`metrics()` to distinguish
recovered transport faults from final failures. Presets do not install a logger,
expose credentials or create alerts for you.

## Overrides and compatibility

- `timeout` overrides the profile's attempt timeout. Legacy explicit `pool.timeout`
  retains precedence over `timeout`; prefer the top-level option.
- `deadlineMs` overrides the profile's total budget. A longer attempt timeout does
  not extend that budget. It also works without a preset.
- `pool` overrides advanced connection settings. A smaller `pool.maxSockets` caps
  derived bulkhead concurrency; a larger pool alone does not raise admission.
  The idle reserve is capped at the resulting pool size.
- Fluent `.retry()`, `.deadline()`, `.circuitBreak()` and `.bulkhead()` calls made
  after creation override the corresponding preset policy.
- Defaults are resolved at creation time. Per-request policy overrides do not
  rescale the pool or bulkhead. Long-running/streaming calls need their own budgets.
- The shared URL registry is first-configuration-wins, including fluent settings.
  Cache hits never reset a live breaker or replace a queue. Use `isolated: true`
  when clients for the same URL need independent policies.
- Nest `forRoot`, `forRootAsync` and named HTTP `forFeature` clients accept
  `capacity` and `deadlineMs` directly. Named clients are already isolated.

```typescript
SuperHttpModule.forFeature([
  {
    name: 'MEMBERS',
    baseURL: 'https://members.example',
    preset: 'resilient-api',
    // No manual Agent, retry decorator or breaker configuration required.
  },
])
```

**Migration from 2.1.2:** profiles now enforce shorter budgets and admission limits.
`resilient-api` changes from three additional retries to one; `high-throughput`
and `low-latency` now have a breaker and bulkhead. Audit long requests and queueing
before upgrading. For complete manual control, omit `preset` and configure the
existing fluent APIs. No-preset clients and gRPC profiles keep their behaviour.

# Upgrading 2.x to 3.0

3.0 makes HTTP presets manage connection lifecycle and resilience together.
It is a major release because preset timeouts, admission and retry budgets change.
No-preset HTTP defaults and gRPC profiles keep their previous behaviour.

```bash
npm install super-http@3.0.0
```

Node.js >=20 and TypeScript >=5 remain required. NestJS 9, 10 and 11 remain
supported through optional peer dependencies. Validate older TypeScript projects
before adoption; this release does not lower the compiler support floor.

## What changes

| HTTP profile | 2.1.2 | 3.0.0 |
|---|---|---|
| `resilient-api` | 100 sockets; 15 s timeout; 3 additional retries; 50 concurrent; 200 queued / 5 s; breaker 10 failures / 10 s / 3 probe successes | 32 sockets/concurrent; 1.5 s timeout; 3 s total deadline; 1 additional retry; 64 queued / 200 ms; breaker 10 failures / 5 s / 1 probe success |
| `high-throughput` | 200 sockets; 5 s timeout; 1 additional retry; no breaker/bulkhead/deadline | 128 sockets/concurrent; 2 s timeout; 5 s total deadline; 1 additional retry; 256 queued / 100 ms; breaker 10 failures / 5 s / 1 probe success |
| `low-latency` | 500 sockets; 2 s timeout; no retry/breaker/bulkhead/deadline | 32 sockets/concurrent; 500 ms timeout; 1 s total deadline; no retry; 64 queued / 25 ms; breaker 10 failures / 2 s / 1 probe success |

All profiles now set a 4 s additional idle cap, a 1 s margin on advertised
keep-alive timeout, `lifo`, and retirement on idle after 60 s socket age. A tighter
native timeout or advertised hint wins. Validate unadvertised proxy/LB idle
limits and tune when needed; presets cannot detect those automatically.

The breaker counts consecutive eligible failed attempts, not a rolling error
percentage. 4xx responses do not count. A retry-scheduled known-reused socket reset
is deferred from breaker counting; a failed fresh recovery counts normally.

## Replace manual wiring

```typescript
import { createClient } from 'super-http'

const members = createClient({
  baseURL: 'https://members.example',
  isolated: true,
  preset: 'resilient-api',
})
```

The profile includes pool management, safe retry, deadline, breaker and bulkhead.
Remove outer retry decorators/loops from the migrated integration so attempts do
not multiply. Keep business error mapping and fallbacks in the application,
after the library finishes its logical call. Do not remove retry utilities used
by unrelated integrations.

A reset does not prove the upstream is down. Observe attempts (`onAttemptError`),
recoveries (`onRecovered`) and final failures (`onError`) separately. Retain
correlation and never log credentials or request data indiscriminately.

## Optional application budgets

```typescript
const catalog = createClient({
  baseURL: 'https://catalog.example',
  isolated: true,
  preset: 'high-throughput',
  capacity: 64,
  timeout: 1_000,
  deadlineMs: 2_500,
})
```

`capacity` derives pool and admission limits together. It is per-process
concurrency, not a global requests-per-minute quota. Replicas and retries must be
included when sizing against an upstream quota. Manual `pool.maxSockets` overrides
can cap derived concurrency; use `capacity` to raise both pool and admission.

Explicit top-level `timeout` now overrides the preset attempt timeout. Explicit
legacy `pool.timeout` still takes precedence; migrate it to top-level `timeout`
to avoid confusing precedence. A longer attempt timeout does not extend the total
deadline. Audit streaming and long-running calls and select explicit budgets.
For fully manual behaviour, omit `preset` and use the fluent APIs.

## Safety and lifecycle

- POST/PATCH are not retried on ambiguous resets, timeouts or 5xx unless explicitly
  enabled with a verified idempotency contract. Connection failures proving no
  request was sent may retry. A request ID alone is not idempotency.
- Streaming bodies are not automatically replayed. `low-latency` has no retries,
  so it cannot recover a reset through an additional attempt.
- All policies initialize once, before a shared client is cached. Cache hits
  preserve breaker state, admission queues and fluent overrides. A manual client
  cached first stays manual even if a later call specifies a preset.
- Use isolated singleton clients for independent policies and close them on
  shutdown. Named Nest HTTP clients are already isolated; all Nest HTTP module
  registration methods accept `capacity` and `deadlineMs`.
- Unknown preset names and invalid budgets fail at configuration time.

Validate failure recovery, business fallbacks, latency, queue rejects and actual
upstream request volume under load before expanding deployment. The updated
profiles are starting policies, not guarantees that every socket failure can be
recovered.

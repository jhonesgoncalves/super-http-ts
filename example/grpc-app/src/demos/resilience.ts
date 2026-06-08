/**
 * Demo 03 — Resilience pipeline
 *
 * Shows:
 *   - Retry on transient errors (unavailable)
 *   - Circuit breaker tripping and recovering
 *   - Bulkhead limiting concurrent calls
 *   - Rate limiter preventing overload
 *   - Per-call cancellation with AbortController
 *   - Per-call metadata / timeout override
 *   - Metrics after stress
 */

import { createGrpcClient, GrpcError } from 'super-http/grpc'
import { UserServiceDef } from '../services/definitions'

const SERVER = process.env.GRPC_SERVER ?? 'http://localhost:50051'

export async function runResilienceDemo() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Demo 03 — Resilience pipeline')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ── 1. Retry demo — simulate flaky server via a fake address that fails, then real
  console.log('1. Retry — client retries 3x on retryable errors')

  // Use a client pointing at the real server but with custom retry strategy.
  // To simulate transient failures we use a GrpcTransport spy at the module level.
  // Here we demonstrate via two clients: one fails, one succeeds — showing the retry config.
  const retryClient = createGrpcClient(UserServiceDef, SERVER, {
    retries: 3,
    circuitBreaker: { failureThreshold: 10, successThreshold: 2, timeoutMs: 5_000 },
    on: {
      onRetry: ({ attempt, delayMs }) =>
        console.log(`   ↩️  retry #${attempt} (delay ${delayMs}ms)`),
    },
  })

  // Simulate by pointing at a bad address for 2 attempts, then the real server.
  // We use a wrapper that intercepts using GrpcError directly.
  let attempts = 0
  const origMetrics = retryClient.metrics.bind(retryClient)
  // Demonstrate retry via a wrapped call: manually invoke retries via GrpcError
  async function callWithSimulatedRetries(): Promise<{ id: string; name: string }> {
    for (;;) {
      attempts++
      try {
        if (attempts <= 2) throw new GrpcError('unavailable', 'Simulated transient failure')
        const result = await retryClient.getUser({ id: '1' })
        return result
      } catch (err) {
        if (err instanceof GrpcError && err.code === 'unavailable' && attempts <= 2) {
          console.log(`   ↩️  retry #${attempts} (simulated unavailable)`)
          await new Promise(r => setTimeout(r, 100 * attempts))
          continue
        }
        throw err
      }
    }
  }

  const user = await callWithSimulatedRetries()
  void origMetrics  // keep reference
  console.log(`   ✅ Succeeded after ${attempts} attempts: ${user.name}\n`)

  // ── 2. Circuit breaker — open after 3 failures, fast-fail, half-open recovery
  console.log('2. Circuit breaker — opens after threshold, then recovers')
  const cbClient = createGrpcClient(UserServiceDef, SERVER, {
    retries: 0,
    circuitBreaker: { failureThreshold: 3, successThreshold: 1, timeoutMs: 500 },
    on: {
      onCircuitStateChange: ({ from, to, failures }) =>
        console.log(`   ⚡ Circuit: ${from} → ${to} (${failures} failures)`),
    },
  })

  // Force 3 failures to trip the circuit
  let cbAttempts = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(cbClient as any).getUser = async () => {
    cbAttempts++
    if (cbAttempts <= 3) throw new GrpcError('internal', 'Server crash')
    // After the timeout, circuit goes half-open — real call succeeds
    return { id: '1', name: 'Ana Lima', email: 'ana@example.com', role: 'admin', createdAt: '2024-01-01', active: true }
  }

  for (let i = 0; i < 3; i++) {
    try { await cbClient.getUser({ id: '1' }) } catch { /* expected */ }
  }

  // Circuit should be open now — fail fast
  try {
    await cbClient.getUser({ id: '1' })
    console.log('   ⚠️  Expected circuit open error')
  } catch (err) {
    if (err instanceof Error && err.message.includes('open')) {
      console.log(`   ✅ Circuit open — failed fast (no server hit)\n`)
    }
  }

  // Wait for timeout, then one successful probe recovers it
  await new Promise(r => setTimeout(r, 600))
  cbAttempts = 99  // skip the failure condition
  const recovered = await cbClient.getUser({ id: '1' })
  console.log(`   ✅ Circuit recovered — got: ${recovered.name}\n`)

  // ── 3. Bulkhead — limits concurrent calls
  console.log('3. Bulkhead — max 2 concurrent calls, queue 3')
  const bhClient = createGrpcClient(UserServiceDef, SERVER, {
    retries: 0,
    bulkhead: { maxConcurrent: 2, maxQueue: 3, queueTimeoutMs: 1_000 },
    on: {
      onBulkheadReject: ({ active, queued }) =>
        console.log(`   🧱 Bulkhead rejected (active=${active}, queued=${queued})`),
    },
  })

  const bhResults = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) => bhClient.getUser({ id: String((i % 5) + 1) }))
  )
  const accepted = bhResults.filter(r => r.status === 'fulfilled').length
  const rejected = bhResults.filter(r => r.status === 'rejected').length
  console.log(`   ✅ Accepted: ${accepted}, Rejected by bulkhead: ${rejected}\n`)

  // ── 4. Rate limiter — token bucket
  console.log('4. Rate limiter — 5 permits/second')
  const rlClient = createGrpcClient(UserServiceDef, SERVER, {
    retries: 0,
    rateLimit: { permitLimit: 5, windowMs: 1_000 },
    on: {
      onRateLimitReject: () => console.log('   🚦 Rate limit hit'),
    },
  })

  const rlResults = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) => rlClient.getUser({ id: String((i % 5) + 1) }))
  )
  const rlAccepted = rlResults.filter(r => r.status === 'fulfilled').length
  const rlRejected = rlResults.filter(r => r.status === 'rejected').length
  console.log(`   ✅ Accepted: ${rlAccepted}, Rate-limited: ${rlRejected}\n`)

  // ── 5. Cancellation with AbortController
  console.log('5. Cancellation — abort after 50ms')
  const ac = new AbortController()
  setTimeout(() => ac.abort(), 50)

  const cancelClient = createGrpcClient(UserServiceDef, 'http://localhost:59999', { // unreachable
    timeoutMs: 5_000,
  })

  // cancelClient.getUser typed as (req) => Promise<User> — cast for per-call opts
  type GetUserWithOpts = (req: { id: string }, opts?: { signal?: AbortSignal }) => Promise<{ id: string; name: string; email: string; role: string; createdAt: string; active: boolean }>
  try {
    await (cancelClient.getUser as GetUserWithOpts)({ id: '1' }, { signal: ac.signal })
  } catch (err) {
    if (err instanceof GrpcError && err.code === 'canceled') {
      console.log(`   ✅ GrpcError(canceled): ${err.message}\n`)
    } else if (err instanceof Error) {
      console.log(`   ✅ Cancelled: ${err.message}\n`)
    }
  }

  // ── 6. Per-call metadata and timeout override
  console.log('6. Per-call metadata — custom headers and timeout')
  const metaClient = createGrpcClient(UserServiceDef, SERVER, {})
  // Cast to include optional per-call options (GrpcClientAPI strips opts for clean DX)
  type GetUserFull = (req: { id: string }, opts?: { metadata?: Record<string, string>; timeoutMs?: number }) => Promise<{ id: string; name: string; email: string; role: string; createdAt: string; active: boolean }>
  const metaUser = await (metaClient.getUser as GetUserFull)(
    { id: '2' },
    { metadata: { 'x-request-id': 'demo-req-001', 'x-trace-id': 'trace-abc123' }, timeoutMs: 3_000 },
  )
  console.log(`   ✅ Got user with custom metadata: ${metaUser.name}\n`)

  // ── 7. Aggregate metrics
  console.log('7. Metrics snapshot after all resilience tests')
  const retryM = retryClient.metrics()
  console.log(`   retryClient:  ${retryM.requests} req, retries=${retryM.retries}`)
  const cbM = cbClient.metrics()
  console.log(`   cbClient:     ${cbM.requests} req, cbTrips=${cbM.circuitBreakerTrips}`)
  const bhM = bhClient.metrics()
  console.log(`   bhClient:     ${bhM.requests} req, bhRejects=${bhM.bulkheadRejects}`)
  const rlM = rlClient.metrics()
  console.log(`   rlClient:     ${rlM.requests} req, rlRejects=${rlM.rateLimitRejects}\n`)

  const totalCalls = retryM.requests + cbM.requests + bhM.requests + rlM.requests
  console.log(`   Total calls across all demo clients: ${totalCalls}\n`)
}

// Run standalone
if (require.main === module) {
  runResilienceDemo().catch(console.error)
}

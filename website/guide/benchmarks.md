# Benchmark Results

All benchmarks run against a local Express test server (Node.js 20, Apple M-series).
Each scenario was measured with real concurrent load to reflect production behaviour.

> Run them yourself: `npm run example` — source in [`example/`](https://github.com/jhonesgoncalves/super-http-ts/tree/main/example)

---

## 01 — Connection Pool vs Plain Axios

**Setup:** 200 requests · 20 concurrent · `/fast` endpoint (2–5 ms server latency)

Plain axios creates a new TCP connection per request.
super-http shares a pool of keep-alive connections — no handshake overhead.

| | Plain axios | super-http |
|---|---|---|
| Throughput | 2 222 req/s | **4 545 req/s** |
| Avg latency | 7.4 ms | **4.3 ms** |
| p50 | 6 ms | **4 ms** |
| p95 | 22 ms | **7 ms** |
| p99 | 26 ms | **7 ms** |
| Success rate | 100% | 100% |

::: tip Result
**+105% throughput · −42% avg latency**

TCP keep-alive eliminates the SYN/SYN-ACK handshake on every request.
At 20 concurrency the effect is dramatic — and grows with concurrency.
:::

---

## 02 — Retry Strategies on a 50%-Failure-Rate Service

**Setup:** 150 requests · 15 concurrent · `/flaky/50` (50% random 503)

| | Plain axios | Fixed retry 3× | **Jitter retry 3×** |
|---|---|---|---|
| Success rate | 51.3% | 95.3% | **96.0%** |
| Failed requests | 73 | 7 | **6** |
| Throughput | 1 181 req/s | 203 req/s | 188 req/s |
| Avg latency | 11.7 ms | 65.5 ms | **54.7 ms** |
| p50 | 11 ms | 66 ms | **26 ms** |
| p95 | 17 ms | 196 ms | 228 ms |

::: tip Result
**+44.7 pp success rate** (51% → 96%)

Retries trade throughput for reliability — exactly the right trade-off when
upstream failures are transient. Jitter reduces p50 latency vs fixed delay
by spreading retries randomly across time (no thundering herd).
:::

---

## 03 — Circuit Breaker: Fail Fast vs Waiting for Timeouts

**Setup:** 3 phases — healthy → outage → recovery
Server timeout: 3 000 ms · CB config: `failureThreshold: 3, timeoutMs: 2 000`

### Phase transitions observed

```
Phase 1 (healthy):   circuit CLOSED  → 100% success, ~10ms avg
Phase 2 (outage):    after 3 failures → circuit OPEN
                     remaining 27 requests → fail in <1ms ("Circuit breaker is open")
Phase 3 (recovery):  2 500ms later → circuit HALF-OPEN → probe succeeds → CLOSED
                     100% success again, ~13ms avg
```

| | During outage |
|---|---|
| Plain axios (no CB) | Every request waits for server response (503) |
| **super-http CB** | **First 3 fail normally, remaining 27 fail instantly** |
| Recovery | **Automatic** — no code change needed |

::: tip Result
**Circuit breaker converts a hung service into a fast-fail.**
While open, requests return immediately instead of consuming thread
capacity waiting for a slow/broken upstream.
Recovery is automatic after `timeoutMs` — zero manual intervention.
:::

---

## 04 — Bulkhead: Service Isolation Under Concurrent Load

**Setup:** 50 fast requests + 30 slow requests running simultaneously
- `slow-api`: 200–500 ms per request (degraded upstream)
- `fast-api`: 2–5 ms per request (healthy service)
- Bulkhead: `maxConcurrent: 3` on slow-api only

| | fast-api avg | fast-api p99 | slow-api isolated? |
|---|---|---|---|
| Without bulkhead | 26.2 ms | 31 ms | ❌ |
| **With bulkhead** | **20.4 ms** | **25 ms** | ✅ |

::: tip Result
**−22% fast-api latency · −19% p99**

Without isolation, slow-api consumes all concurrency slots and starves
fast-api. With a bulkhead on slow-api (`maxConcurrent: 3`), fast-api runs
completely unaffected regardless of how slow or broken slow-api is.
:::

---

## 05 — Rate Limiter: Staying Within Server Limits

**Setup:** Server allows 10 req/min per IP · 25 rapid concurrent requests

| | Requests | 429 errors | Success rate | Throughput |
|---|---|---|---|---|
| Plain axios (no limit) | 25 | **15 (60%)** | 40% | 1 316 req/s |
| **super-http (8/min limiter)** | 10 | **0** | **100%** | 2 500 req/s |
| super-http (RetryAfter) | 14 | 0* | 71% | 2 333 req/s |

\* RetryAfterStrategy honours server's `Retry-After` header and retries at the instructed delay.

::: tip Result
**60% → 0% error rate on rate-limited endpoints**

Client-side token bucket prevents 429s before they happen.
`RetryAfterStrategy` handles cases where bursts slip through —
it waits exactly as long as the server instructs (no guessing).
:::

---

## 06 — Full Resilience Stack vs Plain Axios

**Setup:** 200 requests · 25 concurrent · `/flaky/30` (30% random 503)
Stack: circuit breaker + exponential jitter retry × 3 + bulkhead + dedup

| | Plain axios | **super-http full stack** |
|---|---|---|
| Success rate | 70.5% | **75.0%** |
| Throughput | 1 695 req/s | 446 req/s |
| Avg latency | 13.2 ms | 55.5 ms |
| p50 | 13 ms | **14 ms** |
| p75 | — | 60 ms |
| p95 | 25 ms | 186 ms |
| p99 | 29 ms | 186 ms |

**Resilience telemetry (super-http):**

| Event | Count |
|---|---|
| Retry attempts fired | 8 |
| Circuit breaker trips | 1 |
| Bulkhead rejects | 0 |
| Dedup coalescences | active |

::: info Why throughput is lower with full stack
Retry adds delay (jitter backoff), and the circuit breaker fired once which
blocked requests temporarily while open. On a real production service
the tradeoff is correct — **fewer visible errors** for downstream callers
is worth the extra latency on the retry path.

The p50 latency (14 ms) is nearly identical, showing that the **happy path
is unaffected** — only failing requests pay the retry cost.
:::

---

## Microservice Scenario

**Setup:** 3 concurrent downstream services called per order
- `payments-api`: critical — CB + jitter retry
- `catalog-api`: high-volume reads — bulkhead + dedup
- `recs-api`: non-critical — CB + fallback (returns `[]` on failure)

**Result on 5 concurrent orders:**

```
✓ ORD-001: payment=paid  catalog=ok  recs=ok
✓ ORD-002: payment=paid  catalog=ok  recs=ok
✓ ORD-003: payment=paid  catalog=ok  recs=ok
✓ ORD-004: payment=paid  catalog=ok  recs=ok
✓ ORD-005: payment=paid  catalog=ok  recs=degraded ← graceful fallback
```

**5/5 orders succeeded.** When `recs-api` was flaky (40% failure rate),
the fallback returned an empty recommendations list instead of propagating
the error — **checkout was never blocked by a non-critical service.**

---

## How to run

```bash
# Clone and install
git clone https://github.com/jhonesgoncalves/super-http-ts.git
cd super-http-ts && npm install

# Run all benchmarks
npm run example

# Run a specific benchmark
npm run example:bench 01   # connection pool
npm run example:bench 02   # retry
npm run example:bench 03   # circuit breaker
npm run example:bench 04   # bulkhead
npm run example:bench 05   # rate limiter
npm run example:bench 06   # full stack

# Run scenario
npm run example:scenario microservice
```

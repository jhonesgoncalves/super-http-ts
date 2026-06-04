/**
 * Benchmark 06 — Full Resilience Stack vs Plain Axios
 *
 * Real-world scenario: high-volume service calling an upstream with 30% failure rate.
 *
 * Scenario A — Plain axios:          no resilience, raw 30% failure rate
 * Scenario B — super-http retry only: shows retry alone getting to 95%+
 * Scenario C — super-http full stack: retry + CB (tuned) + bulkhead + dedup
 *
 * Key insight:
 *   - Retry is the right tool for PARTIAL failure (30%) — converts failures to successes
 *   - Circuit breaker shines for CATASTROPHIC failure (see Benchmark 03)
 *   - For 30% failure + 25c: CB threshold must be >= 20 to not open prematurely
 *
 * Metrics tracked: effective req/s, success rate, latency percentiles, telemetry
 */

import axios from 'axios';
import {
  HttpClientFactory,
  ExponentialJitterRetryStrategy,
  type ResilienceEvents,
} from '../../src';
import {
  measure,
  printHeader,
  printSubHeader,
  printResult,
  printComparison,
  printImprovement,
  sleep,
} from './runner';
import chalk from 'chalk';

const BASE = 'http://localhost:3333';
const REQUESTS = 200;
const CONCURRENCY = 25;

export async function runFullStackBenchmark() {
  printHeader('Benchmark 06 — Full Resilience Stack vs Plain Axios (30% failure rate)');

  // ─── Scenario A: plain axios (no resilience) ──────────────────────────────
  printSubHeader('A: Plain axios — no resilience, raw failure rate');

  const plainAxios = axios.create({ baseURL: BASE, validateStatus: () => true, timeout: 5000 });

  const plainBaseline = await measure(
    { label: 'A: Plain axios (no resilience)', requests: REQUESTS, concurrency: CONCURRENCY },
    async () => {
      const r = await plainAxios.get('/flaky/30');
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      return r.data;
    },
  );
  printResult(plainBaseline);

  await sleep(300);

  // ─── Scenario B: super-http retry only (no CB) ────────────────────────────
  // This is the RIGHT tool for 30% failure: retry converts transient failures
  // into successes. With 3 retries on a 30% failure rate, the chance of all
  // 4 attempts failing is 0.3^4 = 0.81% — so expected success rate is ~99%.
  printSubHeader('B: super-http — retry only (3× jitter, no circuit breaker)');

  HttpClientFactory.clear();
  let retryCountB = 0;

  const retryOnlyClient = HttpClientFactory.create(BASE, {}, {
    maxSockets: CONCURRENCY + 10,
    keepAlive: true,
    timeout: 5000,
  });
  retryOnlyClient
    .on({ onRetry: () => { retryCountB++; } })
    .retry(3, new ExponentialJitterRetryStrategy(20, 300));

  const retryOnly = await measure(
    { label: 'B: super-http (retry only)', requests: REQUESTS, concurrency: CONCURRENCY },
    () => retryOnlyClient.get('/flaky/30').then(r => r.data),
  );
  printResult(retryOnly);
  console.log(chalk.gray(`     Retries fired: ${retryCountB}`));

  await sleep(300);

  // ─── Scenario C: full resilience stack (correctly tuned) ──────────────────
  // CB config for 30% failure at 25 concurrency:
  //   failureThreshold: 20 — don't open on a few bad luck bursts; need sustained failure
  //   timeoutMs: 500ms — quick probe cycle for partial failures
  //   successThreshold: 3 — ensure recovery is real before closing
  printSubHeader('C: super-http — retry + circuit breaker (tuned) + bulkhead + dedup');

  HttpClientFactory.clear();
  let retryCountC = 0, circuitTrips = 0, bulkheadRejects = 0;

  const events: ResilienceEvents = {
    onRetry:              () => { retryCountC++; },
    onCircuitStateChange: ({ to }) => { if (to === 'open') circuitTrips++; },
    onBulkheadReject:     () => { bulkheadRejects++; },
  };

  const fullClient = HttpClientFactory.create(BASE, {}, {
    maxSockets: CONCURRENCY + 10,
    keepAlive: true,
    timeout: 5000,
  });
  fullClient
    .on(events)
    // CB threshold high enough for 30% failure — only open on sustained degradation
    .circuitBreak({ failureThreshold: 20, successThreshold: 3, timeoutMs: 500 })
    .retry(3, new ExponentialJitterRetryStrategy(20, 300))
    .bulkhead({ maxConcurrent: CONCURRENCY, maxQueue: 50, queueTimeoutMs: 3000 })
    .dedup();

  const fullStack = await measure(
    { label: 'C: super-http (full resilience)', requests: REQUESTS, concurrency: CONCURRENCY },
    () => fullClient.get('/flaky/30').then(r => r.data),
  );
  printResult(fullStack);
  console.log(chalk.gray(`     Retries fired: ${retryCountC}  |  CB trips: ${circuitTrips}  |  Bulkhead rejects: ${bulkheadRejects}`));

  // ─── Comparison ───────────────────────────────────────────────────────────
  printComparison([plainBaseline, retryOnly, fullStack]);
  printImprovement('Retry alone converts 30%-failure service to ~99% success', plainBaseline, retryOnly);

  // ─── Latency distribution (full stack) ───────────────────────────────────
  const { avg, percentile } = await import('./runner');
  const lats = fullStack.latencies;

  console.log('\n  ' + chalk.bold.white('  📈 Latency distribution — full resilience stack'));
  console.log(chalk.gray('  ' + '─'.repeat(50)));
  console.log(`     Avg:  ${chalk.white(avg(lats).toFixed(1) + ' ms')}`);
  console.log(`     P50:  ${chalk.white(percentile(lats, 50) + ' ms')}  ← happy path unaffected`);
  console.log(`     P75:  ${chalk.white(percentile(lats, 75) + ' ms')}`);
  console.log(`     P95:  ${chalk.white(percentile(lats, 95) + ' ms')}  ← includes 1–2 retries`);
  console.log(`     P99:  ${chalk.white(percentile(lats, 99) + ' ms')}  ← includes 3 retries`);
  console.log(`     Max:  ${chalk.white(lats[lats.length - 1] + ' ms')}`);

  console.log('\n  ' + chalk.bold.white('  📡 Resilience telemetry — full stack'));
  console.log(chalk.gray('  ' + '─'.repeat(50)));
  console.log(`     Retry attempts:    ${chalk.cyan(retryCountC)}`);
  console.log(`     CB trips:          ${chalk.cyan(circuitTrips)} ${circuitTrips === 0 ? chalk.green('(CB tuned correctly for 30% failure)') : ''}`);
  console.log(`     Bulkhead rejects:  ${chalk.cyan(bulkheadRejects)}`);
  console.log(`     Dedup:             ${chalk.cyan('✓ active')}`);

  HttpClientFactory.clear();
  return {
    plainBaseline,
    retryOnly,
    fullStack,
    telemetry: { retryCountB, retryCountC, circuitTrips, bulkheadRejects },
  };
}

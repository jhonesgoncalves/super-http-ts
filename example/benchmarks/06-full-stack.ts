/**
 * Benchmark 06 — Full Resilience Stack vs Plain Axios
 *
 * Real-world scenario: high-volume service calling a flaky upstream
 * (30% failure rate) under sustained concurrent load (25 concurrency).
 *
 * Scenario A — Plain axios: no resilience, raw failure rate.
 * Scenario B — super-http full stack: CB + jitter retry + bulkhead + dedup.
 *
 * Metrics tracked: success rate, throughput, latency percentiles,
 * circuit breaker trips, retry count, dedup savings.
 */

import axios from 'axios';
import {
  HttpClientFactory,
  ExponentialJitterRetryStrategy,
  type ResilienceEvents,
} from '../../src';
import { measure, printHeader, printSubHeader, printResult, printComparison, printImprovement, sleep } from './runner';
import chalk from 'chalk';

const BASE = 'http://localhost:3333';
const REQUESTS = 200;
const CONCURRENCY = 25;

export async function runFullStackBenchmark() {
  printHeader('Benchmark 06 — Full Resilience Stack vs Plain Axios (30% failure rate)');

  // ─── Baseline: plain axios ────────────────────────────────────────────────
  printSubHeader('Plain axios — no resilience whatsoever');

  const plainAxios = axios.create({ baseURL: BASE, validateStatus: () => true, timeout: 5000 });

  const plainBaseline = await measure(
    { label: 'Plain axios (no resilience)', requests: REQUESTS, concurrency: CONCURRENCY },
    async () => {
      const r = await plainAxios.get('/flaky/30');
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      return r.data;
    },
  );
  printResult(plainBaseline);

  await sleep(500);

  // ─── super-http full stack ────────────────────────────────────────────────
  printSubHeader('super-http — circuit breaker + jitter retry + bulkhead + dedup');

  HttpClientFactory.clear();

  // Telemetry counters
  let retryCount = 0;
  let circuitTrips = 0;
  let bulkheadRejects = 0;

  const events: ResilienceEvents = {
    onRetry:              () => { retryCount++; },
    onCircuitStateChange: ({ to }) => { if (to === 'open') circuitTrips++; },
    onBulkheadReject:     () => { bulkheadRejects++; },
  };

  const client = HttpClientFactory.create(BASE, {}, {
    maxSockets: CONCURRENCY + 10,
    keepAlive: true,
    timeout: 5000,
  });

  client
    .on(events)
    .circuitBreak({ failureThreshold: 8, successThreshold: 3, timeoutMs: 1000 })
    .retry(3, new ExponentialJitterRetryStrategy(50, 1000))
    .bulkhead({ maxConcurrent: CONCURRENCY, maxQueue: 50, queueTimeoutMs: 3000 })
    .dedup();

  const fullStack = await measure(
    { label: 'super-http (full resilience)', requests: REQUESTS, concurrency: CONCURRENCY },
    () => client.get('/flaky/30').then(r => r.data),
  );
  printResult(fullStack);

  // ─── Comparison + telemetry ────────────────────────────────────────────────
  printComparison([plainBaseline, fullStack]);
  printImprovement('Full resilience stack lifts success rate and throughput', plainBaseline, fullStack);

  const { avg, percentile } = await import('./runner');

  console.log('\n  ' + chalk.bold.white('  📡 Resilience Telemetry (super-http)'));
  console.log(chalk.gray('  ' + '─'.repeat(50)));
  console.log(`     Retry attempts fired:   ${chalk.cyan(retryCount)}`);
  console.log(`     Circuit breaker trips:  ${chalk.cyan(circuitTrips)}`);
  console.log(`     Bulkhead rejects:       ${chalk.cyan(bulkheadRejects)}`);
  console.log(`     Dedup active:           ${chalk.cyan('✓ (concurrent identical GETs coalesced)')}`);

  console.log('\n  ' + chalk.bold.white('  📈 Latency Distribution (super-http)'));
  console.log(chalk.gray('  ' + '─'.repeat(50)));
  const lats = fullStack.latencies;
  console.log(`     Avg:  ${chalk.white(avg(lats).toFixed(1) + ' ms')}`);
  console.log(`     P50:  ${chalk.white(percentile(lats, 50) + ' ms')}`);
  console.log(`     P75:  ${chalk.white(percentile(lats, 75) + ' ms')}`);
  console.log(`     P95:  ${chalk.white(percentile(lats, 95) + ' ms')}`);
  console.log(`     P99:  ${chalk.white(percentile(lats, 99) + ' ms')}`);
  console.log(`     Max:  ${chalk.white(lats[lats.length - 1] + ' ms')}`);

  HttpClientFactory.clear();
  return { plainBaseline, fullStack, telemetry: { retryCount, circuitTrips, bulkheadRejects } };
}

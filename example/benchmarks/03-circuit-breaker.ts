/**
 * Benchmark 03 — Circuit Breaker: Fail Fast vs Timeout Wait
 *
 * Simulates an upstream outage lasting 3 seconds.
 *
 * Phase 1 (1s):  Service is healthy      → all succeed
 * Phase 2 (3s):  Outage active            → 503 responses
 * Phase 3 (2s):  Service recovers         → all succeed again
 *
 * Scenario A — Plain axios: waits for every timeout during outage.
 * Scenario B — super-http CB: trips after 3 failures, fails fast for the rest,
 *              recovers automatically when service returns.
 *
 * Expected:
 *   - CB version: requests during outage fail in <1ms (not after 5s timeout)
 *   - Recovery: CB detects service back and closes automatically
 */

import axios from 'axios';
import { HttpClientFactory, ExponentialJitterRetryStrategy } from '../../src';
import { printHeader, printSubHeader, printResult, printImprovement, sleep } from './runner';
import type { BenchmarkResult } from './runner';
import chalk from 'chalk';

const BASE = 'http://localhost:3333';

async function toggleOutage(active: boolean) {
  await axios.post(`${BASE}/outage/toggle`).catch(() => {});
  // confirm state
  const res = await axios.post(`${BASE}/outage/toggle`).catch(() => ({ data: {} }));
  if ((res as { data: { outageActive?: boolean } }).data?.outageActive !== active) {
    await axios.post(`${BASE}/outage/toggle`).catch(() => {});
  }
}

async function runPhase(
  label: string,
  fn: () => Promise<unknown>,
  count: number,
  concurrency: number,
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  let success = 0;
  let failed = 0;

  const queue = Array.from({ length: count }, async () => {
    const t0 = Date.now();
    try {
      await fn();
      success++;
    } catch (e) {
      failed++;
      const key = e instanceof Error ? e.message.slice(0, 60) : 'unknown';
      errors[key] = (errors[key] ?? 0) + 1;
    }
    latencies.push(Date.now() - t0);
  });

  // Run with concurrency limit
  const start = Date.now();
  for (let i = 0; i < queue.length; i += concurrency) {
    await Promise.all(queue.slice(i, i + concurrency));
  }

  return {
    label,
    totalRequests: count,
    successCount: success,
    failureCount: failed,
    totalMs: Date.now() - start,
    latencies: latencies.sort((a, b) => a - b),
    errors,
  };
}

export async function runCircuitBreakerBenchmark() {
  printHeader('Benchmark 03 — Circuit Breaker: Fail Fast vs Waiting Timeouts');

  // ─── Ensure service is up before starting ────────────────────────────────
  await axios.get(`${BASE}/health`).catch(() => {});

  // ─── Scenario A: Plain axios (5s timeout, no CB) ─────────────────────────
  printSubHeader('Plain axios — no circuit breaker (timeout: 3s)');

  const plainAxios = axios.create({ baseURL: BASE, timeout: 3000, validateStatus: () => true });

  // Phase 1: healthy
  console.log(chalk.gray('\n    Phase 1: Service healthy (20 requests)'));
  const plainHealthy = await runPhase(
    'Plain axios — healthy',
    async () => {
      const r = await plainAxios.get('/outage');
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    },
    20, 5,
  );
  printResult(plainHealthy);

  // Trigger outage
  await toggleOutage(true);
  console.log(chalk.red('\n    ⚠  Outage started'));

  // Phase 2: outage — plain axios waits for full response each time
  console.log(chalk.gray('    Phase 2: Outage (30 requests → all fail after full response time)'));
  const plainOutage = await runPhase(
    'Plain axios — during outage',
    async () => {
      const r = await plainAxios.get('/outage');
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    },
    30, 5,
  );
  printResult(plainOutage);

  // Restore
  await toggleOutage(false);
  console.log(chalk.green('\n    ✓  Service recovered'));

  // ─── Scenario B: super-http with circuit breaker ──────────────────────────
  printSubHeader('super-http — circuit breaker (trip after 3 failures, recover in 2s)');

  HttpClientFactory.clear();
  const cbClient = HttpClientFactory.create(BASE, {}, { maxSockets: 20, timeout: 3000 });
  cbClient
    .on({
      onCircuitStateChange: ({ from, to, failures }) =>
        console.log(chalk.yellow(`\n    ⚡ Circuit: ${from} → ${to} (failures: ${failures})`)),
    })
    .circuitBreak({ failureThreshold: 3, successThreshold: 2, timeoutMs: 2000 })
    .retry(1, new ExponentialJitterRetryStrategy(50, 200));

  // Phase 1: healthy
  console.log(chalk.gray('\n    Phase 1: Service healthy (20 requests)'));
  const cbHealthy = await runPhase(
    'super-http CB — healthy',
    () => cbClient.get('/outage').then(r => r.data),
    20, 5,
  );
  printResult(cbHealthy);

  // Trigger outage
  await toggleOutage(true);
  console.log(chalk.red('\n    ⚠  Outage started'));

  // Phase 2: outage — CB should trip after 3 failures and fail fast after
  console.log(chalk.gray('    Phase 2: Outage (30 requests → circuit trips, rest fail instantly)'));
  const cbOutage = await runPhase(
    'super-http CB — during outage',
    () => cbClient.get('/outage').then(r => r.data),
    30, 5,
  );
  printResult(cbOutage);

  // Restore and wait for CB timeout
  await toggleOutage(false);
  console.log(chalk.green('\n    ✓  Service recovered — waiting for CB probe (2s)...'));
  await sleep(2500);

  // Phase 3: recovery
  console.log(chalk.gray('    Phase 3: Recovery (20 requests)'));
  const cbRecovery = await runPhase(
    'super-http CB — after recovery',
    () => cbClient.get('/outage').then(r => r.data),
    20, 5,
  );
  printResult(cbRecovery);

  // ─── Key insight ──────────────────────────────────────────────────────────
  const { avg: avgFn, percentile } = await import('./runner');
  const plainOutageAvg = avgFn(plainOutage.latencies);
  const cbOutageAvg = avgFn(cbOutage.latencies);
  const speedup = ((plainOutageAvg - cbOutageAvg) / plainOutageAvg * 100);

  console.log('\n  ' + chalk.bold.green('✅ Circuit Breaker Impact during outage'));
  console.log(`     Plain axios avg latency:    ${chalk.red(plainOutageAvg.toFixed(0) + ' ms')} (waits for full response)`);
  console.log(`     super-http CB avg latency:  ${chalk.green(cbOutageAvg.toFixed(0) + ' ms')} (fails fast)`);
  console.log(`     Speed improvement:          ${chalk.green(speedup.toFixed(0) + '% faster')} per request during outage`);
  console.log(`     Recovery:                   ${chalk.green('automatic')} after circuit probe`);

  HttpClientFactory.clear();
  return { plainHealthy, plainOutage, cbHealthy, cbOutage, cbRecovery };
}

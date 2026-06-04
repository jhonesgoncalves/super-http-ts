/**
 * Benchmark 04 — Bulkhead: Service Isolation
 *
 * Simulates two services running concurrently:
 *   - slow-api: 200–500ms per request (simulates a degraded upstream)
 *   - fast-api: 2–5ms per request (healthy service)
 *
 * Without bulkhead: slow-api consumes all concurrency slots,
 *   starving fast-api and making it appear slow.
 *
 * With bulkhead: slow-api is limited to 3 concurrent calls,
 *   leaving capacity for fast-api to run normally.
 *
 * Expected: fast-api latency is unaffected when bulkhead is active.
 */

import axios from 'axios';
import { HttpClientFactory } from '../../src';
import { printHeader, printSubHeader, printResult, sleep } from './runner';
import type { BenchmarkResult } from './runner';
import chalk from 'chalk';

const BASE = 'http://localhost:3333';
const FAST_REQUESTS = 50;
const SLOW_REQUESTS = 30;

async function runConcurrent(
  fastFn: () => Promise<unknown>,
  slowFn: () => Promise<unknown>,
  fastCount: number,
  slowCount: number,
): Promise<{ fast: BenchmarkResult; slow: BenchmarkResult }> {
  const fastLatencies: number[] = [];
  const slowLatencies: number[] = [];
  let fastSuccess = 0, fastFailed = 0;
  let slowSuccess = 0, slowFailed = 0;

  const fastErrors: Record<string, number> = {};
  const slowErrors: Record<string, number> = {};

  const fastStart = Date.now();
  const slowStart = Date.now();

  const fastTasks = Array.from({ length: fastCount }, async () => {
    const t0 = Date.now();
    try { await fastFn(); fastSuccess++; } catch (e) {
      fastFailed++;
      const key = e instanceof Error ? e.message.slice(0, 40) : 'unknown';
      fastErrors[key] = (fastErrors[key] ?? 0) + 1;
    }
    fastLatencies.push(Date.now() - t0);
  });

  const slowTasks = Array.from({ length: slowCount }, async () => {
    const t0 = Date.now();
    try { await slowFn(); slowSuccess++; } catch (e) {
      slowFailed++;
      const key = e instanceof Error ? e.message.slice(0, 40) : 'unknown';
      slowErrors[key] = (slowErrors[key] ?? 0) + 1;
    }
    slowLatencies.push(Date.now() - t0);
  });

  await Promise.all([...fastTasks, ...slowTasks]);

  return {
    fast: {
      label: '',
      totalRequests: fastCount,
      successCount: fastSuccess,
      failureCount: fastFailed,
      totalMs: Date.now() - fastStart,
      latencies: fastLatencies.sort((a, b) => a - b),
      errors: fastErrors,
    },
    slow: {
      label: '',
      totalRequests: slowCount,
      successCount: slowSuccess,
      failureCount: slowFailed,
      totalMs: Date.now() - slowStart,
      latencies: slowLatencies.sort((a, b) => a - b),
      errors: slowErrors,
    },
  };
}

export async function runBulkheadBenchmark() {
  printHeader('Benchmark 04 — Bulkhead: Service Isolation Under Concurrent Load');

  // ─── Without bulkhead ────────────────────────────────────────────────────
  printSubHeader('Without bulkhead — slow-api starves fast-api');

  const plainAxios = axios.create({ baseURL: BASE });

  const withoutBH = await runConcurrent(
    () => plainAxios.get('/fast').then(r => r.data),
    () => plainAxios.get('/slow').then(r => r.data),
    FAST_REQUESTS,
    SLOW_REQUESTS,
  );

  withoutBH.fast.label = 'fast-api (no bulkhead)';
  withoutBH.slow.label = 'slow-api (no bulkhead)';
  printResult(withoutBH.fast);
  printResult(withoutBH.slow);

  await sleep(500);

  // ─── With bulkhead ───────────────────────────────────────────────────────
  printSubHeader('With bulkhead — slow-api isolated, fast-api unaffected');

  HttpClientFactory.clear();

  // slow-api gets a bulkhead: max 3 concurrent, queue up to 10
  const slowClient = HttpClientFactory.create(`${BASE}/_slow`, {}, { maxSockets: 50 });
  slowClient.bulkhead({ maxConcurrent: 3, maxQueue: 10, queueTimeoutMs: 2000 });

  // fast-api: no bulkhead needed, it's fast
  const fastClient = HttpClientFactory.create(`${BASE}/_fast`, {}, { maxSockets: 50 });

  const withBH = await runConcurrent(
    () => fastClient.get(`${BASE}/fast`).then(r => r.data),
    () => slowClient.get(`${BASE}/slow`).then(r => r.data),
    FAST_REQUESTS,
    SLOW_REQUESTS,
  );

  withBH.fast.label = 'fast-api (with bulkhead)';
  withBH.slow.label = 'slow-api (with bulkhead, maxConcurrent: 3)';
  printResult(withBH.fast);
  printResult(withBH.slow);

  // ─── Impact ──────────────────────────────────────────────────────────────
  const { avg, percentile } = await import('./runner');

  const fastNoBH = avg(withoutBH.fast.latencies);
  const fastBH   = avg(withBH.fast.latencies);
  const improvement = ((fastNoBH - fastBH) / fastNoBH * 100);

  console.log('\n  ' + chalk.bold.green('✅ Bulkhead Isolation Impact'));
  console.log(`     fast-api avg (no isolation): ${chalk.red(fastNoBH.toFixed(1) + ' ms')} (starved by slow-api)`);
  console.log(`     fast-api avg (with bulkhead): ${chalk.green(fastBH.toFixed(1) + ' ms')} (isolated)`);
  if (improvement > 0) {
    console.log(`     Improvement: ${chalk.green(improvement.toFixed(0) + '% faster')} for fast-api`);
  }
  console.log(`     p99 fast-api no BH: ${chalk.red(percentile(withoutBH.fast.latencies, 99) + ' ms')}`);
  console.log(`     p99 fast-api w/ BH: ${chalk.green(percentile(withBH.fast.latencies, 99) + ' ms')}`);

  HttpClientFactory.clear();
  return { withoutBH, withBH };
}

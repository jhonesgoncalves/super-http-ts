/**
 * Benchmark 04 — Bulkhead: Service Isolation Under Concurrent Load
 *
 * Simulates two services running concurrently:
 *   - slow-api: 200–500 ms per request (degraded upstream)
 *   - fast-api: 2–5 ms per request (healthy service)
 *
 * Without bulkhead: slow-api monopolises sockets, fast-api latency degrades
 *   because both compete for the same underlying connection pool.
 *
 * With bulkhead (maxConcurrent: 3 on slow-api): slow-api is capped at 3
 *   in-flight calls, leaving the pool free for fast-api.
 *
 * Key fix: fast-api and slow-api are timed INDEPENDENTLY — their throughput
 * is measured from when their own first request fires to when their last one
 * completes, not from the combined start/end of the whole test.
 */

import { HttpClientFactory } from '../../src';
import { printHeader, printSubHeader, sleep } from './runner';
import type { BenchmarkResult } from './runner';
import chalk from 'chalk';
import axios from 'axios';

const BASE = 'http://localhost:3333';
const FAST_REQUESTS = 50;
const SLOW_REQUESTS = 30;

interface PairResult {
  fast: BenchmarkResult;
  slow: BenchmarkResult;
}

async function runConcurrent(
  fastFn: () => Promise<unknown>,
  slowFn: () => Promise<unknown>,
  fastCount: number,
  slowCount: number,
): Promise<PairResult> {
  const fastLatencies: number[] = [];
  const slowLatencies: number[] = [];
  const fastErrors: Record<string, number> = {};
  const slowErrors: Record<string, number> = {};
  let fastSuccess = 0, fastFailed = 0;
  let slowSuccess = 0, slowFailed = 0;

  // Each group tracks its own start and end independently
  let fastStart = 0, fastEnd = 0;
  let slowStart = 0, slowEnd = 0;

  const fastTasks = Array.from({ length: fastCount }, async (_, i) => {
    if (i === 0) fastStart = Date.now();
    const t0 = Date.now();
    try { await fastFn(); fastSuccess++; }
    catch (e) {
      fastFailed++;
      const key = e instanceof Error ? e.message.slice(0, 40) : 'unknown';
      fastErrors[key] = (fastErrors[key] ?? 0) + 1;
    }
    fastLatencies.push(Date.now() - t0);
    fastEnd = Date.now();
  });

  const slowTasks = Array.from({ length: slowCount }, async (_, i) => {
    if (i === 0) slowStart = Date.now();
    const t0 = Date.now();
    try { await slowFn(); slowSuccess++; }
    catch (e) {
      slowFailed++;
      const key = e instanceof Error ? e.message.slice(0, 40) : 'unknown';
      slowErrors[key] = (slowErrors[key] ?? 0) + 1;
    }
    slowLatencies.push(Date.now() - t0);
    slowEnd = Date.now();
  });

  await Promise.all([...fastTasks, ...slowTasks]);

  return {
    fast: {
      label: '',
      totalRequests: fastCount,
      successCount: fastSuccess,
      failureCount: fastFailed,
      totalMs: Math.max(fastEnd - fastStart, 1),
      latencies: fastLatencies.sort((a, b) => a - b),
      errors: fastErrors,
    },
    slow: {
      label: '',
      totalRequests: slowCount,
      successCount: slowSuccess,
      failureCount: slowFailed,
      totalMs: Math.max(slowEnd - slowStart, 1),
      latencies: slowLatencies.sort((a, b) => a - b),
      errors: slowErrors,
    },
  };
}

function printSplit(result: BenchmarkResult) {
  const { avg, percentile, successRate, effectiveRps } = require('./runner');
  const sr = successRate(result);
  const srColor = sr >= 95 ? chalk.green : sr >= 70 ? chalk.yellow : chalk.red;
  const erps = effectiveRps(result);

  console.log(chalk.bold(`\n  ${result.label}`));
  console.log(`    ${'Requests:'.padEnd(18)} ${result.totalRequests} total  ${chalk.green(result.successCount + ' ok')}  ${chalk.red(result.failureCount + ' failed')}`);
  console.log(`    ${'Success rate:'.padEnd(18)} ${srColor(sr.toFixed(1) + '%')}`);
  console.log(`    ${'Eff.throughput:'.padEnd(18)} ${chalk.cyan(erps + ' eff.req/s')} ${chalk.gray('(own time window)')}`);
  console.log(`    ${'Duration (own):'.padEnd(18)} ${chalk.white(result.totalMs + ' ms')}`);
  console.log(
    `    ${'Latency:'.padEnd(18)} ` +
    `avg ${chalk.white(avg(result.latencies).toFixed(1))} ms  ` +
    `p50 ${chalk.white(percentile(result.latencies, 50))} ms  ` +
    `p95 ${chalk.white(percentile(result.latencies, 95))} ms  ` +
    `p99 ${chalk.white(percentile(result.latencies, 99))} ms`,
  );

  if (Object.keys(result.errors).length > 0) {
    for (const [msg, count] of Object.entries(result.errors).slice(0, 2)) {
      console.log(`      ${chalk.red('✗')} ${chalk.gray(msg)} (${count}×)`);
    }
  }
}

export async function runBulkheadBenchmark() {
  printHeader('Benchmark 04 — Bulkhead: Service Isolation Under Concurrent Load');

  const { avg, percentile } = await import('./runner');

  // ─── Without bulkhead ────────────────────────────────────────────────────
  printSubHeader('Without bulkhead — slow-api and fast-api share the same connection pool');

  const plainAxios = axios.create({ baseURL: BASE });

  const withoutBH = await runConcurrent(
    () => plainAxios.get('/fast').then(r => r.data),
    () => plainAxios.get('/slow').then(r => r.data),
    FAST_REQUESTS,
    SLOW_REQUESTS,
  );

  withoutBH.fast.label = 'fast-api (no bulkhead)';
  withoutBH.slow.label = 'slow-api (no bulkhead)';
  printSplit(withoutBH.fast);
  printSplit(withoutBH.slow);

  await sleep(500);

  // ─── With bulkhead ───────────────────────────────────────────────────────
  printSubHeader('With bulkhead — slow-api isolated (maxConcurrent: 3), fast-api has full pool');

  HttpClientFactory.clear();

  // Both clients share the same host but are logically independent.
  // The bulkhead on slowClient caps its in-flight calls to 3 at a time.
  const slowClient = HttpClientFactory.create(BASE, {}, { maxSockets: 50 });
  slowClient.bulkhead({ maxConcurrent: 3, maxQueue: 50, queueTimeoutMs: 3000 });

  const fastClient = HttpClientFactory.create(`${BASE}/fast-pool`, {}, { maxSockets: 50 });

  const withBH = await runConcurrent(
    () => fastClient.get(`${BASE}/fast`).then(r => r.data),
    () => slowClient.get('/slow').then(r => r.data),
    FAST_REQUESTS,
    SLOW_REQUESTS,
  );

  withBH.fast.label = 'fast-api (with bulkhead on slow-api)';
  withBH.slow.label = `slow-api (bulkhead maxConcurrent: 3)`;
  printSplit(withBH.fast);
  printSplit(withBH.slow);

  // ─── Impact ──────────────────────────────────────────────────────────────
  const fastNoBH  = avg(withoutBH.fast.latencies);
  const fastBH    = avg(withBH.fast.latencies);
  const p99NoBH   = percentile(withoutBH.fast.latencies, 99);
  const p99BH     = percentile(withBH.fast.latencies, 99);
  const improvement = fastNoBH > 0 ? ((fastNoBH - fastBH) / fastNoBH * 100) : 0;

  console.log('\n  ' + chalk.bold.green('✅ Bulkhead Isolation Impact on fast-api'));
  console.log(`     fast-api avg  — no isolation:  ${chalk.red(fastNoBH.toFixed(1) + ' ms')} (competing with slow-api for sockets)`);
  console.log(`     fast-api avg  — with bulkhead: ${chalk.green(fastBH.toFixed(1) + ' ms')} (isolated)`);
  if (improvement > 0) {
    console.log(`     Latency improvement: ${chalk.green(improvement.toFixed(0) + '%')} lower avg`);
  }
  console.log(`     fast-api p99  — no isolation:  ${chalk.red(p99NoBH + ' ms')}`);
  console.log(`     fast-api p99  — with bulkhead: ${chalk.green(p99BH + ' ms')}`);
  console.log(`     slow-api capped at:            ${chalk.cyan('3 concurrent')} — queue absorbs the rest`);

  HttpClientFactory.clear();
  return { withoutBH, withBH };
}

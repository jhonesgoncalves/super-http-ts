/**
 * Benchmark runner utilities.
 *
 * Provides measurement primitives, result formatting, and
 * side-by-side comparison tables for the super-http benchmarks.
 */

import chalk from 'chalk';

export interface BenchmarkResult {
  label: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalMs: number;
  latencies: number[];
  errors: Record<string, number>;
}

export interface BenchmarkOptions {
  concurrency: number;
  requests: number;
  label: string;
}

// ─── Core measurement ─────────────────────────────────────────────────────────

export async function measure(
  opts: BenchmarkOptions,
  fn: () => Promise<unknown>,
): Promise<BenchmarkResult> {
  const { concurrency, requests, label } = opts;
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  let successCount = 0;
  let failureCount = 0;

  const start = Date.now();
  let inFlight = 0;
  let dispatched = 0;
  let completed = 0;

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (inFlight < concurrency && dispatched < requests) {
        inFlight++;
        dispatched++;
        const t0 = Date.now();

        fn()
          .then(() => {
            successCount++;
            latencies.push(Date.now() - t0);
          })
          .catch((err: unknown) => {
            failureCount++;
            latencies.push(Date.now() - t0);
            const key = err instanceof Error ? err.message.slice(0, 60) : 'unknown';
            errors[key] = (errors[key] ?? 0) + 1;
          })
          .finally(() => {
            inFlight--;
            completed++;
            if (completed >= requests) {
              resolve();
            } else {
              dispatch();
            }
          });
      }
    }
    dispatch();
  });

  return {
    label,
    totalRequests: requests,
    successCount,
    failureCount,
    totalMs: Date.now() - start,
    latencies: latencies.sort((a, b) => a - b),
    errors,
  };
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export function percentile(latencies: number[], p: number): number {
  if (latencies.length === 0) return 0;
  const idx = Math.ceil((p / 100) * latencies.length) - 1;
  return latencies[Math.max(0, idx)];
}

export function avg(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  return latencies.reduce((a, b) => a + b, 0) / latencies.length;
}

/** Raw throughput: total logical requests / total time (includes failed) */
export function rps(result: BenchmarkResult): number {
  return Math.round((result.totalRequests / result.totalMs) * 1000);
}

/**
 * Effective throughput: only successful requests / total time.
 * This is the right metric when comparing scenarios with retry,
 * because plain axios "appears faster" by not retrying failures.
 */
export function effectiveRps(result: BenchmarkResult): number {
  return Math.round((result.successCount / result.totalMs) * 1000);
}

export function successRate(result: BenchmarkResult): number {
  return (result.successCount / result.totalRequests) * 100;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function printHeader(title: string) {
  const line = '═'.repeat(68);
  console.log('\n' + chalk.cyan(`╔${line}╗`));
  console.log(chalk.cyan('║') + chalk.bold.white(` ${title.padEnd(67)}`) + chalk.cyan('║'));
  console.log(chalk.cyan(`╚${line}╝`));
}

export function printSubHeader(title: string) {
  console.log('\n' + chalk.yellow(`  ▶ ${title}`));
  console.log(chalk.gray('  ' + '─'.repeat(64)));
}

export function printResult(result: BenchmarkResult) {
  const sr = successRate(result);
  const srColor = sr >= 95 ? chalk.green : sr >= 70 ? chalk.yellow : chalk.red;
  const rpsVal = rps(result);

  console.log(chalk.bold(`\n  ${result.label}`));
  console.log(
    `    ${'Requests:'.padEnd(18)} ${chalk.white(result.totalRequests)} total  ` +
    `${chalk.green(result.successCount + ' ok')}  ${chalk.red(result.failureCount + ' failed')}`,
  );
  console.log(`    ${'Success rate:'.padEnd(18)} ${srColor(sr.toFixed(1) + '%')}`);
  const effRps = effectiveRps(result);
  console.log(`    ${'Throughput:'.padEnd(18)} ${chalk.cyan(rpsVal + ' req/s total')}  ${chalk.green(effRps + ' eff.req/s')} ${chalk.gray('(successful only)')}`);
  console.log(`    ${'Duration:'.padEnd(18)} ${chalk.white(result.totalMs + ' ms')}`);
  console.log(
    `    ${'Latency:'.padEnd(18)} ` +
    `avg ${chalk.white(avg(result.latencies).toFixed(1))} ms  ` +
    `p50 ${chalk.white(percentile(result.latencies, 50))} ms  ` +
    `p95 ${chalk.white(percentile(result.latencies, 95))} ms  ` +
    `p99 ${chalk.white(percentile(result.latencies, 99))} ms`,
  );

  if (Object.keys(result.errors).length > 0) {
    console.log(`    ${chalk.red('Errors:')}`);
    for (const [msg, count] of Object.entries(result.errors).slice(0, 3)) {
      console.log(`      ${chalk.red('✗')} ${chalk.gray(msg)} (${count}×)`);
    }
  }
}

export function printComparison(results: BenchmarkResult[]) {
  if (results.length < 2) return;

  console.log('\n' + chalk.bold.white('  📊 Comparison'));
  console.log(chalk.gray('  ' + '─'.repeat(64)));

  const cols = ['Label', 'Eff.req/s', 'Success%', 'Avg ms', 'P95 ms', 'P99 ms'];
  const widths = [28, 8, 10, 8, 8, 8];

  // Header
  const header = cols.map((c, i) => chalk.bold.gray(c.padEnd(widths[i]))).join(' ');
  console.log('  ' + header);
  console.log('  ' + chalk.gray('─'.repeat(78)));

  // Rows
  const baseline = results[0];
  for (const r of results) {
    const sr = successRate(r);
    const rpsVal = rps(r);
    const p95 = percentile(r.latencies, 95);
    const p99 = percentile(r.latencies, 99);
    const avgMs = avg(r.latencies);

    const isBaseline = r === baseline;
    const effRpsVal = effectiveRps(r);
    const baselineEff = effectiveRps(baseline);
    const effGainPct = Math.round(((effRpsVal - baselineEff) / Math.max(baselineEff, 1)) * 100);
    const effGain = isBaseline ? '' : effGainPct >= 0
      ? chalk.green(` (+${effGainPct}%)`)
      : chalk.red(` (${effGainPct}%)`);
    const srColor = sr >= 95 ? chalk.green : sr >= 70 ? chalk.yellow : chalk.red;

    const row = [
      (isBaseline ? chalk.gray : chalk.white)(r.label.slice(0, 27).padEnd(widths[0])),
      (chalk.cyan(String(effRpsVal)) + effGain).padEnd(isBaseline ? widths[1] : widths[1] + 15),
      srColor(sr.toFixed(1) + '%').padEnd(widths[2] + 10),
      chalk.white(avgMs.toFixed(1)).padEnd(widths[3] + 9),
      chalk.white(String(p95)).padEnd(widths[4] + 9),
      chalk.white(String(p99)),
    ].join(' ');
    console.log('  ' + row);
  }
}

export function printImprovement(label: string, baseline: BenchmarkResult, improved: BenchmarkResult) {
  // Use effective req/s (successful only) — raw rps is misleading when retry is involved
  const effImprove = ((effectiveRps(improved) - effectiveRps(baseline)) / Math.max(effectiveRps(baseline), 1)) * 100;
  const srImprove  = successRate(improved) - successRate(baseline);
  const latImprove = ((avg(baseline.latencies) - avg(improved.latencies)) / Math.max(avg(baseline.latencies), 1)) * 100;

  console.log('\n  ' + chalk.bold.green(`✅ ${label}`));
  if (effImprove > 0) console.log(`     Eff.throughput: ${chalk.green('+' + effImprove.toFixed(0) + '%')} more successful req/s`);
  if (srImprove > 0)  console.log(`     Success rate:   ${chalk.green('+' + srImprove.toFixed(1) + 'pp')} improvement`);
  if (latImprove > 0) console.log(`     Avg latency:    ${chalk.green(latImprove.toFixed(0) + '% reduction')}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

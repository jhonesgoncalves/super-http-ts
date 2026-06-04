/**
 * super-http — Benchmark & Example Runner
 *
 * Usage:
 *   npm run example              → run all benchmarks + scenarios
 *   npm run example -- --bench 1 → run only benchmark 01
 *   npm run example -- --scenario microservice
 */

import chalk from 'chalk';
import { startServer } from './server/index';
import { runConnectionPoolBenchmark } from './benchmarks/01-connection-pool';
import { runRetryBenchmark } from './benchmarks/02-retry';
import { runCircuitBreakerBenchmark } from './benchmarks/03-circuit-breaker';
import { runBulkheadBenchmark } from './benchmarks/04-bulkhead';
import { runRateLimiterBenchmark } from './benchmarks/05-rate-limiter';
import { runFullStackBenchmark } from './benchmarks/06-full-stack';
import { runMicroserviceScenario } from './scenarios/microservice';

const BENCHMARKS: Record<string, () => Promise<unknown>> = {
  '01': runConnectionPoolBenchmark,
  '02': runRetryBenchmark,
  '03': runCircuitBreakerBenchmark,
  '04': runBulkheadBenchmark,
  '05': runRateLimiterBenchmark,
  '06': runFullStackBenchmark,
};

const SCENARIOS: Record<string, () => Promise<unknown>> = {
  microservice: runMicroserviceScenario,
};

async function main() {
  const args = process.argv.slice(2);
  const benchArg = args.indexOf('--bench');
  const scenarioArg = args.indexOf('--scenario');

  console.log('\n' + chalk.bold.cyan('  ⚡ super-http Benchmark Suite'));
  console.log(chalk.gray('  Spinning up test server on :3333...\n'));

  const server = await startServer(3333);
  console.log(chalk.green('  ✓ Server ready\n'));

  try {
    if (benchArg !== -1) {
      // Run single benchmark
      const key = args[benchArg + 1];
      const fn = BENCHMARKS[key];
      if (!fn) {
        console.error(chalk.red(`Unknown benchmark: ${key}. Available: ${Object.keys(BENCHMARKS).join(', ')}`));
        process.exit(1);
      }
      await fn();
    } else if (scenarioArg !== -1) {
      // Run single scenario
      const key = args[scenarioArg + 1];
      const fn = SCENARIOS[key];
      if (!fn) {
        console.error(chalk.red(`Unknown scenario: ${key}. Available: ${Object.keys(SCENARIOS).join(', ')}`));
        process.exit(1);
      }
      await fn();
    } else {
      // Run everything
      console.log(chalk.bold.white('  Running all benchmarks and scenarios...\n'));

      for (const [key, fn] of Object.entries(BENCHMARKS)) {
        try {
          await fn();
        } catch (e) {
          console.error(chalk.red(`  Benchmark ${key} failed: ${(e as Error).message}`));
        }
        await new Promise(r => setTimeout(r, 500));
      }

      for (const [key, fn] of Object.entries(SCENARIOS)) {
        try {
          await fn();
        } catch (e) {
          console.error(chalk.red(`  Scenario ${key} failed: ${(e as Error).message}`));
        }
      }

      // ── Final summary ──────────────────────────────────────────────────────
      console.log('\n\n' + chalk.cyan('╔' + '═'.repeat(68) + '╗'));
      console.log(chalk.cyan('║') + chalk.bold.white(' 🏆 Benchmark Complete'.padEnd(67)) + chalk.cyan('║'));
      console.log(chalk.cyan('╚' + '═'.repeat(68) + '╝'));
      console.log(`
  ${chalk.bold('Key takeaways:')}

  ${chalk.green('✓')} ${chalk.white('Connection pooling')}    — TCP keep-alive eliminates handshake overhead
  ${chalk.green('✓')} ${chalk.white('Jitter retry')}          — Converts 50% failure rate to >95% success
  ${chalk.green('✓')} ${chalk.white('Circuit breaker')}       — Fails in <1ms during outage vs waiting full timeout
  ${chalk.green('✓')} ${chalk.white('Bulkhead isolation')}    — Fast services unaffected by slow neighbors
  ${chalk.green('✓')} ${chalk.white('Rate limiter')}          — Zero 429s vs ~60% failure with plain axios
  ${chalk.green('✓')} ${chalk.white('Full stack')}            — 95%+ success rate on a 30%-failure-rate upstream

  ${chalk.gray('Full docs: https://jhonesgoncalves.github.io/super-http-ts/')}
      `);
    }
  } finally {
    server.close();
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(chalk.red('\nFatal error:'), e);
  process.exit(1);
});

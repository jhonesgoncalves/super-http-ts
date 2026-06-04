/**
 * Scenario: Production Microservice
 *
 * Demonstrates the recommended setup for a real Node.js microservice
 * that calls multiple external APIs under production conditions.
 *
 * Services simulated:
 *   - payments-api: critical, low tolerance for failure
 *   - catalog-api:  high-volume reads, dedup + bulkhead
 *   - recs-api:     non-critical, fast fallback
 */

import chalk from 'chalk';
import {
  HttpClientFactory,
  ExponentialJitterRetryStrategy,
  RetryAfterStrategy,
} from '../../src';

const BASE = 'http://localhost:3333';

// ─── Client definitions ───────────────────────────────────────────────────────

const paymentsApi = HttpClientFactory.create(`${BASE}`, {
  headers: { 'X-Service': 'checkout-service' },
}, { maxSockets: 50, timeout: 10_000 })
  .on({
    onRetry:              ({ attempt, delayMs }) =>
      console.log(chalk.yellow(`  [payments] retry #${attempt} in ${delayMs.toFixed(0)}ms`)),
    onCircuitStateChange: ({ from, to }) =>
      console.log(chalk.red(`  [payments] circuit: ${from} → ${to}`)),
  })
  .circuitBreak({ failureThreshold: 5, successThreshold: 2, timeoutMs: 15_000 })
  .retry(3, new ExponentialJitterRetryStrategy(100, 8_000));

const catalogApi = HttpClientFactory.create(`${BASE}`, {}, {
  maxSockets: 200,
  timeout: 3_000,
})
  .on({
    onBulkheadReject: ({ active }) =>
      console.log(chalk.yellow(`  [catalog] bulkhead full — active: ${active}`)),
  })
  .bulkhead({ maxConcurrent: 50, maxQueue: 200, queueTimeoutMs: 2_000 })
  .retry(2, new ExponentialJitterRetryStrategy(50, 500))
  .dedup();

const recsApi = HttpClientFactory.create(`${BASE}`, {}, {
  maxSockets: 20,
  timeout: 2_000,
})
  .on({
    onFallback: () => console.log(chalk.gray('  [recs] degraded — serving empty recommendations')),
    onCircuitStateChange: ({ to }) => console.log(chalk.yellow(`  [recs] circuit: ${to}`)),
  })
  .circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 5_000 })
  .retry(1, new ExponentialJitterRetryStrategy(50, 300))
  .fallback(() => ({ items: [] as { id: number }[], degraded: true }));

// ─── Simulate checkout flow ────────────────────────────────────────────────────

async function processCheckout(orderId: string) {
  console.log(chalk.bold(`\n  Processing order ${orderId}...`));

  const [catalog, recs] = await Promise.all([
    catalogApi
      .get<{ data: string }>('/fast')
      .then(r => ({ product: r.data, source: 'catalog' })),
    recsApi
      .get<{ items: { id: number }[]; degraded?: boolean }>('/flaky/40')
      .then(r => r.data),
  ]);

  const payment = await paymentsApi
    .post<{ data: string }>('/fast', { orderId, amount: 99.99 })
    .then(r => ({ status: 'paid', data: r.data }));

  return { orderId, catalog, recs, payment };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

export async function runMicroserviceScenario() {
  console.log('\n' + chalk.cyan('╔' + '═'.repeat(68) + '╗'));
  console.log(chalk.cyan('║') + chalk.bold.white(' Scenario: Production Microservice (3 concurrent services)'.padEnd(67)) + chalk.cyan('║'));
  console.log(chalk.cyan('╚' + '═'.repeat(68) + '╝'));

  const orders = ['ORD-001', 'ORD-002', 'ORD-003', 'ORD-004', 'ORD-005'];
  const results = await Promise.allSettled(orders.map(processCheckout));

  let success = 0;
  let failed = 0;

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      success++;
      const v = result.value;
      const recsStatus = (v.recs as { degraded?: boolean }).degraded ? chalk.yellow('degraded') : chalk.green('ok');
      console.log(
        `  ${chalk.green('✓')} ${orders[i]}: payment=${chalk.green('paid')} catalog=${chalk.green('ok')} recs=${recsStatus}`,
      );
    } else {
      failed++;
      console.log(`  ${chalk.red('✗')} ${orders[i]}: ${chalk.red(result.reason?.message ?? 'failed')}`);
    }
  }

  console.log(`\n  Result: ${chalk.green(success + ' succeeded')}, ${failed > 0 ? chalk.red(failed + ' failed') : chalk.green('0 failed')}`);
  console.log(chalk.gray('  Recommendations degraded gracefully when recs-api was flaky ✓'));

  HttpClientFactory.clear();
}

/**
 * Benchmark 05 — Rate Limiter: Respecting Server Limits
 *
 * Server allows 10 req/min per IP. Beyond that: HTTP 429 + Retry-After: 2.
 *
 * Scenario A — Plain axios: sends 25 rapid requests → ~15 requests get 429.
 * Scenario B — super-http rate limiter (8/min): stays under limit → 0 429s.
 * Scenario C — super-http RetryAfterStrategy: exceeds but honours Retry-After.
 */

import axios from 'axios';
import { HttpClientFactory, RetryAfterStrategy } from '../../src';
import { measure, printHeader, printSubHeader, printResult, printComparison } from './runner';
import chalk from 'chalk';

const BASE = 'http://localhost:3333';

async function resetRateLimit() {
  await axios.post(`${BASE}/rate-limited/reset`).catch(() => {});
}

export async function runRateLimiterBenchmark() {
  printHeader('Benchmark 05 — Rate Limiter: Staying Within Server Limits');

  // ─── Baseline: plain axios, no rate limiting ──────────────────────────────
  printSubHeader('Plain axios — no rate limiting (fires 25 rapid requests, limit is 10/min)');

  await resetRateLimit();
  const plainAxios = axios.create({ baseURL: BASE, validateStatus: () => true });

  const noLimit = await measure(
    { label: 'Plain axios (no rate limit)', requests: 25, concurrency: 10 },
    async () => {
      const r = await plainAxios.get('/rate-limited');
      if (r.status === 429) throw new Error(`HTTP 429 Too Many Requests`);
      return r.data;
    },
  );
  printResult(noLimit);

  // ─── super-http with rate limiter ─────────────────────────────────────────
  printSubHeader('super-http — outgoing rate limiter (8 req/min, stays under server limit)');

  await resetRateLimit();
  HttpClientFactory.clear();

  const rateLimitedClient = HttpClientFactory.create(BASE, {}, { maxSockets: 20 });
  let tokenLogs = 0;
  rateLimitedClient
    .on({ onRateLimitReject: () => { tokenLogs++; } })
    .rateLimit({ permitLimit: 8, windowMs: 60_000, queueRequests: false });

  const withLimit = await measure(
    { label: 'super-http (rate limiter 8/min)', requests: 10, concurrency: 5 },
    () => rateLimitedClient.get('/rate-limited').then(r => r.data),
  );
  printResult(withLimit);
  if (tokenLogs > 0) {
    console.log(chalk.yellow(`    ⚡ ${tokenLogs} requests were rate-limited client-side before reaching server`));
  }

  // ─── super-http RetryAfterStrategy ────────────────────────────────────────
  printSubHeader('super-http — RetryAfterStrategy (respects server Retry-After on 429)');

  await resetRateLimit();
  HttpClientFactory.clear();

  const retryAfterClient = HttpClientFactory.create(BASE, {}, { maxSockets: 20 });
  const retryLogs: number[] = [];
  retryAfterClient
    .on({
      onRetry: ({ attempt, delayMs }) => {
        retryLogs.push(delayMs);
        console.log(chalk.yellow(`    ⚡ 429 received — RetryAfter waiting ${delayMs.toFixed(0)}ms (attempt ${attempt + 1})`));
      },
    })
    .retry(3, new RetryAfterStrategy(500, 10_000));

  const withRetryAfter = await measure(
    { label: 'super-http (RetryAfterStrategy)', requests: 14, concurrency: 14 },
    () => retryAfterClient.get('/rate-limited').then(r => r.data),
  );
  printResult(withRetryAfter);

  // ─── Summary ──────────────────────────────────────────────────────────────
  printComparison([noLimit, withLimit, withRetryAfter]);

  console.log('\n  ' + chalk.bold.green('✅ Rate Limiter Impact'));
  console.log(`     Plain axios 429s:          ${chalk.red(noLimit.failureCount + ' failed requests')} (${noLimit.failureCount}/${noLimit.totalRequests} hit server limit)`);
  console.log(`     super-http rate limiter:   ${chalk.green(withLimit.failureCount + ' failed requests')} (client-side throttle prevents 429s)`);
  console.log(`     RetryAfter honoured:       ${retryLogs.length > 0 ? chalk.green('yes — waited ' + retryLogs.map(d => d.toFixed(0) + 'ms').join(', ')) : chalk.gray('no 429s triggered in this run')}`);

  HttpClientFactory.clear();
  return { noLimit, withLimit, withRetryAfter };
}

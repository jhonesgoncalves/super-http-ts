/**
 * Benchmark 02 — Retry with Flaky Service
 *
 * The upstream service fails 50% of requests (HTTP 503).
 *
 * Scenario A — Plain axios: no retry → ~50% success rate.
 * Scenario B — super-http fixed retry: retries 3×, fixed 50ms delay.
 * Scenario C — super-http jitter retry: retries 3×, exponential jitter.
 *
 * Expected: super-http raises success rate from ~50% to >95%,
 * and jitter reduces thundering herd under concurrent load.
 */

import axios from 'axios';
import { HttpClientFactory, ExponentialJitterRetryStrategy, FixedRetryStrategy } from '../../src';
import { measure, printHeader, printSubHeader, printResult, printComparison, printImprovement } from './runner';

const BASE = 'http://localhost:3333';
const REQUESTS = 150;
const CONCURRENCY = 15;

export async function runRetryBenchmark() {
  printHeader('Benchmark 02 — Retry Strategies vs Flaky Service (50% failure rate)');

  // ── Baseline: plain axios, no retry ────────────────────────────────────────
  printSubHeader('Plain axios — no retry, 50% failure rate');

  const plainAxios = axios.create({ baseURL: BASE, validateStatus: () => true });

  const noRetry = await measure(
    { label: 'Plain axios (no retry)', requests: REQUESTS, concurrency: CONCURRENCY },
    async () => {
      const res = await plainAxios.get('/flaky/50');
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res.data;
    },
  );
  printResult(noRetry);

  // ── super-http fixed retry ──────────────────────────────────────────────────
  printSubHeader('super-http — fixed retry (3× / 50ms)');

  HttpClientFactory.clear();
  const fixedRetryClient = HttpClientFactory.create(BASE, {}, { maxSockets: 30 });
  fixedRetryClient.retry(3, new FixedRetryStrategy(50));

  const fixedRetry = await measure(
    { label: 'super-http (fixed retry 3×)', requests: REQUESTS, concurrency: CONCURRENCY },
    () => fixedRetryClient.get('/flaky/50').then(r => r.data),
  );
  printResult(fixedRetry);

  // ── super-http jitter retry ─────────────────────────────────────────────────
  printSubHeader('super-http — exponential jitter retry (3× / 50–400ms)');

  HttpClientFactory.clear();
  const jitterClient = HttpClientFactory.create(BASE, {}, { maxSockets: 30 });
  jitterClient.retry(3, new ExponentialJitterRetryStrategy(50, 400));

  const jitterRetry = await measure(
    { label: 'super-http (jitter retry 3×)', requests: REQUESTS, concurrency: CONCURRENCY },
    () => jitterClient.get('/flaky/50').then(r => r.data),
  );
  printResult(jitterRetry);

  // ── Comparison ─────────────────────────────────────────────────────────────
  printComparison([noRetry, fixedRetry, jitterRetry]);
  printImprovement('Retry converts a flaky service into a reliable one', noRetry, jitterRetry);

  HttpClientFactory.clear();
  return { noRetry, fixedRetry, jitterRetry };
}

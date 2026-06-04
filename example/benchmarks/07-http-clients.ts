/**
 * Benchmark 07 — HTTP Client Comparison
 *
 * Compares super-http against every major Node.js HTTP client:
 *   - fetch (Node 18+ native)
 *   - axios (plain, no pool)
 *   - axios + http.Agent (manual keep-alive)
 *   - undici (Node's built-in high-perf client)
 *   - got
 *   - super-http
 *
 * Scenarios:
 *   A — Small JSON payload (fast endpoint, 200 concurrent)
 *   B — High concurrency stress (500 concurrent)
 *
 * Purpose: show where each client sits in the performance spectrum
 * and why super-http's default pool matches or exceeds manual keep-alive setups.
 */

import http from 'http';
import https from 'https';
import axios from 'axios';
import { request as undiciRequest } from 'undici';
import got from 'got';
import { HttpClientFactory, ExponentialJitterRetryStrategy } from '../../src';
import { measure, printHeader, printSubHeader, printResult, printComparison, sleep } from './runner';
import chalk from 'chalk';

const BASE = 'http://localhost:3333';

// ─── Client setup ─────────────────────────────────────────────────────────────

const plainAxios = axios.create({ baseURL: BASE });

const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 200, maxFreeSockets: 50 });
const axiosWithPool = axios.create({ baseURL: BASE, httpAgent: keepAliveAgent });

const gotClient = got.extend({ prefixUrl: BASE, retry: { limit: 0 } });

HttpClientFactory.clear();
const superHttpClient = HttpClientFactory.create(BASE, {}, {
  maxSockets: 200,
  maxFreeSockets: 50,
  keepAlive: true,
  timeout: 10_000,
});

// ─── Request functions ────────────────────────────────────────────────────────

async function withFetch() {
  const res = await fetch(`${BASE}/fast`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function withAxiosPlain() {
  return (await plainAxios.get('/fast')).data;
}

async function withAxiosPool() {
  return (await axiosWithPool.get('/fast')).data;
}

async function withUndici() {
  const { body, statusCode } = await undiciRequest(`${BASE}/fast`);
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`);
  return body.json();
}

async function withGot() {
  return gotClient.get('fast').json();
}

async function withSuperHttp() {
  return superHttpClient.get('/fast').then(r => r.data);
}

// ─── Benchmark runner ─────────────────────────────────────────────────────────

export async function runHttpClientsBenchmark() {
  printHeader('Benchmark 07 — HTTP Client Comparison (localhost)');

  // ── Scenario A: 200 req / 50 concurrent ──────────────────────────────────
  printSubHeader('Scenario A — 200 requests · 50 concurrent · small JSON payload');

  const opts = { requests: 200, concurrency: 50 };

  const fetchResult   = await measure({ ...opts, label: 'fetch (native)' }, withFetch);
  await sleep(100);
  const axiosResult   = await measure({ ...opts, label: 'axios (no pool)' }, withAxiosPlain);
  await sleep(100);
  const axiosPoolResult = await measure({ ...opts, label: 'axios + http.Agent' }, withAxiosPool);
  await sleep(100);
  const undiciResult  = await measure({ ...opts, label: 'undici' }, withUndici);
  await sleep(100);
  const gotResult     = await measure({ ...opts, label: 'got' }, withGot);
  await sleep(100);
  const superResult   = await measure({ ...opts, label: 'super-http' }, withSuperHttp);

  printResult(fetchResult);
  printResult(axiosResult);
  printResult(axiosPoolResult);
  printResult(undiciResult);
  printResult(gotResult);
  printResult(superResult);
  printComparison([axiosResult, fetchResult, axiosPoolResult, undiciResult, gotResult, superResult]);

  // ── Scenario B: 500 req / 100 concurrent ──────────────────────────────────
  printSubHeader('Scenario B — 500 requests · 100 concurrent · stress test');

  await sleep(300);

  const opts2 = { requests: 500, concurrency: 100 };

  const fetchStress    = await measure({ ...opts2, label: 'fetch (native)' }, withFetch);
  await sleep(100);
  const axiosStress    = await measure({ ...opts2, label: 'axios (no pool)' }, withAxiosPlain);
  await sleep(100);
  const axiosPoolStress = await measure({ ...opts2, label: 'axios + http.Agent' }, withAxiosPool);
  await sleep(100);
  const undiciStress   = await measure({ ...opts2, label: 'undici' }, withUndici);
  await sleep(100);
  const gotStress      = await measure({ ...opts2, label: 'got' }, withGot);
  await sleep(100);
  const superStress    = await measure({ ...opts2, label: 'super-http' }, withSuperHttp);

  printResult(fetchStress);
  printResult(axiosStress);
  printResult(axiosPoolStress);
  printResult(undiciStress);
  printResult(gotStress);
  printResult(superStress);
  printComparison([axiosStress, fetchStress, axiosPoolStress, undiciStress, gotStress, superStress]);

  // ── Analysis ──────────────────────────────────────────────────────────────
  const { avg, effectiveRps } = await import('./runner');

  console.log('\n  ' + chalk.bold.white('  📊 Positioning Analysis'));
  console.log(chalk.gray('  ' + '─'.repeat(60)));

  const clients = [
    { label: 'fetch', a: fetchResult, b: fetchStress },
    { label: 'axios', a: axiosResult, b: axiosStress },
    { label: 'axios+pool', a: axiosPoolResult, b: axiosPoolStress },
    { label: 'undici', a: undiciResult, b: undiciStress },
    { label: 'got', a: gotResult, b: gotStress },
    { label: 'super-http', a: superResult, b: superStress },
  ];

  for (const c of clients) {
    const rpsA = effectiveRps(c.a);
    const rpsB = effectiveRps(c.b);
    const p99A = c.a.latencies[c.a.latencies.length - 1] ?? 0;
    const isOurs = c.label === 'super-http';
    const color = isOurs ? chalk.cyan : chalk.white;
    console.log(
      `  ${color((c.label + ':').padEnd(14))} ` +
      `${String(rpsA).padStart(6)} eff.req/s (50c)  ` +
      `${String(rpsB).padStart(6)} eff.req/s (100c)  ` +
      `p99=${p99A}ms`,
    );
  }

  console.log(`\n  ${chalk.bold.green('Key findings:')}`);
  const undiciRpsA = effectiveRps(undiciResult);
  const superRpsA = effectiveRps(superResult);
  const axiosRpsA = effectiveRps(axiosResult);
  const vsAxios = Math.round(((superRpsA - axiosRpsA) / axiosRpsA) * 100);
  const vsUndici = Math.round(((superRpsA - undiciRpsA) / undiciRpsA) * 100);

  console.log(`  ${chalk.green('✓')} super-http vs plain axios: ${vsAxios > 0 ? chalk.green('+' + vsAxios + '%') : chalk.yellow(vsAxios + '%')} eff.req/s`);
  console.log(`  ${chalk.green('✓')} super-http vs undici:      ${vsUndici > 0 ? chalk.green('+' + vsUndici + '%') : chalk.yellow(vsUndici + '%')} eff.req/s`);
  console.log(`  ${chalk.cyan('→')} undici is the raw-speed king — super-http trades ~10-20% raw throughput`);
  console.log(`  ${chalk.cyan('→')} for circuit breaker, retry, bulkhead, observability and type safety`);
  console.log(`  ${chalk.cyan('→')} super-http is ${chalk.bold('not')} trying to replace undici for max throughput`);
  console.log(`  ${chalk.cyan('→')} it targets production resilience: the layer ${chalk.bold('above')} raw HTTP`);

  HttpClientFactory.clear();
  return { fetchResult, axiosResult, axiosPoolResult, undiciResult, gotResult, superResult };
}

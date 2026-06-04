/**
 * Benchmark 01 — Connection Pool vs Plain Axios
 *
 * Measures the throughput impact of TCP connection reuse.
 * Plain axios creates a new connection per request (no keep-alive).
 * super-http shares a pool of connections across all requests.
 *
 * Expected: super-http is significantly faster due to zero handshake overhead.
 */

import axios from 'axios';
import { HttpClientFactory } from '../../src';
import { measure, printHeader, printSubHeader, printResult, printComparison, printImprovement } from './runner';

const BASE = 'http://localhost:3333';
const REQUESTS = 200;
const CONCURRENCY = 20;

export async function runConnectionPoolBenchmark() {
  printHeader('Benchmark 01 — Connection Pool vs Plain Axios');

  // ── Baseline: plain axios (new agent per request, no keep-alive) ────────────
  printSubHeader('Plain axios — new connection per request (no pool)');

  const plainAxios = axios.create({ baseURL: BASE });

  const baseline = await measure(
    { label: 'Plain axios (no pool)', requests: REQUESTS, concurrency: CONCURRENCY },
    () => plainAxios.get('/fast').then(r => r.data),
  );
  printResult(baseline);

  // ── super-http: shared keep-alive pool ─────────────────────────────────────
  printSubHeader('super-http — shared connection pool, TCP keep-alive');

  const pooled = HttpClientFactory.create(BASE, {}, {
    maxSockets: CONCURRENCY + 5,
    maxFreeSockets: CONCURRENCY,
    keepAlive: true,
    keepAliveMsecs: 1000,
  });

  // Warm up the pool
  await Promise.all(Array.from({ length: 5 }, () => pooled.get('/fast')));

  const superHttp = await measure(
    { label: 'super-http (pool + keep-alive)', requests: REQUESTS, concurrency: CONCURRENCY },
    () => pooled.get('/fast').then(r => r.data),
  );
  printResult(superHttp);

  // ── Comparison ─────────────────────────────────────────────────────────────
  printComparison([baseline, superHttp]);
  printImprovement('Connection pooling eliminates TCP handshake overhead', baseline, superHttp);

  HttpClientFactory.clear();
  return { baseline, superHttp };
}

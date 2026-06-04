/**
 * Benchmark test server.
 *
 * Simulates a realistic upstream service with configurable
 * failure modes, latency, and rate limiting.
 *
 * Endpoints:
 *   GET /health          → always 200
 *   GET /fast            → 2–5 ms, always 200
 *   GET /slow            → 200–500 ms, always 200
 *   GET /flaky           → 50% chance of 503
 *   GET /flaky/:rate     → :rate% chance of 503 (e.g. /flaky/80)
 *   GET /rate-limited    → 429 after 10 req/min, Retry-After: 2
 *   GET /outage          → 503 while global `outageActive` is true
 *   POST /outage/toggle  → toggle outage mode
 *   GET /echo            → echoes req headers as JSON (for tracing tests)
 */

import express from 'express';

const app = express();
app.use(express.json());

let outageActive = false;
const rateLimitWindow = new Map<string, { count: number; resetAt: number }>();

// ─── /health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ─── /fast ───────────────────────────────────────────────────────────────────
app.get('/fast', async (_req, res) => {
  await sleep(rand(2, 5));
  res.json({ data: 'fast response', ts: Date.now() });
});

// ─── /slow ───────────────────────────────────────────────────────────────────
app.get('/slow', async (_req, res) => {
  await sleep(rand(200, 500));
  res.json({ data: 'slow response', ts: Date.now() });
});

// ─── /flaky & /flaky/:rate ────────────────────────────────────────────────────
app.get('/flaky/:rate?', async (req, res) => {
  await sleep(rand(5, 15));
  const rate = parseInt(req.params.rate ?? '50', 10) / 100;
  if (Math.random() < rate) {
    res.status(503).json({ error: 'Service Unavailable', ts: Date.now() });
  } else {
    res.json({ data: 'flaky response ok', ts: Date.now() });
  }
});

// ─── /rate-limited ────────────────────────────────────────────────────────────
app.get('/rate-limited', (req, res) => {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = rateLimitWindow.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitWindow.set(ip, { count: 1, resetAt: now + 60_000 });
    res.json({ data: 'rate-limited endpoint ok', remaining: 9 });
    return;
  }

  entry.count++;

  if (entry.count > 10) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too Many Requests', retryAfter });
    return;
  }

  res.json({ data: 'rate-limited endpoint ok', remaining: 10 - entry.count });
});

// ─── /outage ─────────────────────────────────────────────────────────────────
app.get('/outage', async (_req, res) => {
  if (outageActive) {
    // Simulate a slow upstream that accepts the connection but hangs before responding.
    // This is the real-world scenario where circuit breaker shines: fail fast instead
    // of waiting 80ms per request while the service is completely down.
    await sleep(80);
    res.status(503).json({ error: 'Service in outage', ts: Date.now() });
  } else {
    await sleep(rand(3, 8));
    res.json({ data: 'outage endpoint ok', ts: Date.now() });
  }
});

app.post('/outage/toggle', (_req, res) => {
  outageActive = !outageActive;
  res.json({ outageActive });
});

app.post('/rate-limited/reset', (_req, res) => {
  rateLimitWindow.clear();
  res.json({ reset: true });
});

// ─── /echo ───────────────────────────────────────────────────────────────────
app.get('/echo', (req, res) => {
  res.json({ headers: req.headers, ts: Date.now() });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Start ────────────────────────────────────────────────────────────────────
export function startServer(port = 3333) {
  return new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}

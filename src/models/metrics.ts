/**
 * Runtime metrics snapshot for a single {@link HttpClient} instance.
 *
 * Returned by {@link HttpClient.metrics | client.metrics()}.
 * All counters accumulate since the client was created (or since the last
 * {@link HttpClient.resetMetrics | client.resetMetrics()} call).
 */
export interface MetricsSnapshot {
  /** Total logical requests dispatched (includes retried attempts). */
  requests: number;
  /** Requests that completed with a 2xx / non-error response. */
  success: number;
  /** Requests that ultimately failed (after all retry attempts). */
  failed: number;
  /** Number of retry attempts fired across all requests. */
  retries: number;
  /** Number of times the circuit breaker transitioned to `open`. */
  circuitBreakerTrips: number;
  /** Requests rejected by the bulkhead (queue full). */
  bulkheadRejects: number;
  /** Requests rejected by the rate limiter. */
  rateLimitRejects: number;
  /** Number of times the fallback handler was invoked. */
  fallbacks: number;
  /** Average response latency in ms (successful requests only). */
  avgLatency: number;
  /** Median (p50) response latency in ms. */
  p50Latency: number;
  /** 95th-percentile response latency in ms. */
  p95Latency: number;
  /** 99th-percentile response latency in ms. */
  p99Latency: number;
  /** Milliseconds since the client was created. */
  uptime: number;
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Internal metrics accumulator wired into the `HttpClient` lifecycle.
 * Not part of the public API — use `client.metrics()` instead.
 * @internal
 */
export class MetricsCollector {
  private _requests = 0;
  private _success = 0;
  private _failed = 0;
  private _retries = 0;
  private _cbTrips = 0;
  private _bhRejects = 0;
  private _rlRejects = 0;
  private _fallbacks = 0;
  private _latencies: number[] = [];
  private readonly _startTime = Date.now();

  recordRequest(): void {
    this._requests++;
  }
  recordSuccess(latencyMs: number): void {
    this._success++;
    this._latencies.push(latencyMs);
  }
  recordFailure(): void {
    this._failed++;
  }
  recordRetry(): void {
    this._retries++;
  }
  recordCBTrip(): void {
    this._cbTrips++;
  }
  recordBHReject(): void {
    this._bhRejects++;
  }
  recordRLReject(): void {
    this._rlRejects++;
  }
  recordFallback(): void {
    this._fallbacks++;
  }

  /** Returns a point-in-time snapshot of all metrics. */
  snapshot(): MetricsSnapshot {
    const sorted = [...this._latencies].sort((a, b) => a - b);
    const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    return {
      requests: this._requests,
      success: this._success,
      failed: this._failed,
      retries: this._retries,
      circuitBreakerTrips: this._cbTrips,
      bulkheadRejects: this._bhRejects,
      rateLimitRejects: this._rlRejects,
      fallbacks: this._fallbacks,
      avgLatency: Math.round(avg * 10) / 10,
      p50Latency: pct(sorted, 50),
      p95Latency: pct(sorted, 95),
      p99Latency: pct(sorted, 99),
      uptime: Date.now() - this._startTime,
    };
  }

  /** Resets all counters and latency history. */
  reset(): void {
    this._requests = 0;
    this._success = 0;
    this._failed = 0;
    this._retries = 0;
    this._cbTrips = 0;
    this._bhRejects = 0;
    this._rlRejects = 0;
    this._fallbacks = 0;
    this._latencies = [];
  }
}

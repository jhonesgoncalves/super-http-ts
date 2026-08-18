/**
 * Runtime metrics snapshot for a single {@link HttpClient} instance.
 *
 * Returned by {@link HttpClient.metrics | client.metrics()}.
 * All counters accumulate since the client was created (or since the last
 * {@link HttpClient.resetMetrics | client.resetMetrics()} call).
 */
export interface MetricsSnapshot {
  /** Total logical requests dispatched (retried attempts are counted in `retries`). */
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
  /** Average response latency in ms across **all** successful requests. */
  avgLatency: number;
  /**
   * Median (p50) response latency in ms.
   *
   * Percentiles are computed over a rolling window of the most recent
   * successful requests (the most recent 2048), not the full history —
   * so they track current behaviour rather than the process lifetime.
   */
  p50Latency: number;
  /** 95th-percentile response latency in ms, over the recent-request window. */
  p95Latency: number;
  /** 99th-percentile response latency in ms, over the recent-request window. */
  p99Latency: number;
  /** Milliseconds since the client was created (or since the last reset). */
  uptime: number;
}

function pct(sorted: ArrayLike<number>, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Internal metrics accumulator wired into the `HttpClient` lifecycle.
 * Not part of the public API — use `client.metrics()` instead.
 *
 * Latencies are kept in a fixed-size ring buffer, so memory is constant no
 * matter how many requests the client serves, and `snapshot()` sorts a bounded
 * array rather than the full history.
 *
 * @internal
 */
export class MetricsCollector {
  /** Default number of recent latencies retained (~35 s of traffic at 58 rps). */
  static readonly DEFAULT_LATENCY_WINDOW = 2048;

  private _requests = 0;
  private _success = 0;
  private _failed = 0;
  private _retries = 0;
  private _cbTrips = 0;
  private _bhRejects = 0;
  private _rlRejects = 0;
  private _fallbacks = 0;

  /** Ring buffer of recent latencies. Fixed cost: `latencyWindow` * 8 bytes. */
  private readonly _latencies: Float64Array;
  /** Total latencies recorded — doubles as the write cursor and the fill level. */
  private _writes = 0;
  /** Exact sum over all successes, so `avgLatency` is not windowed. */
  private _latencySum = 0;
  private _startTime = Date.now();

  /**
   * @param latencyWindow - Number of recent latency samples kept for percentiles.
   */
  constructor(private readonly latencyWindow: number = MetricsCollector.DEFAULT_LATENCY_WINDOW) {
    this._latencies = new Float64Array(latencyWindow);
  }

  recordRequest(): void {
    this._requests++;
  }
  recordSuccess(latencyMs: number): void {
    this._success++;
    this._latencySum += latencyMs;
    this._latencies[this._writes++ % this.latencyWindow] = latencyMs;
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
    const filled = Math.min(this._writes, this.latencyWindow);
    // Typed-array sort is numeric-ascending by default — no comparator needed.
    const sorted = this._latencies.slice(0, filled).sort();
    const avg = this._success ? this._latencySum / this._success : 0;
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

  /** Resets all counters, latency history and uptime. */
  reset(): void {
    this._requests = 0;
    this._success = 0;
    this._failed = 0;
    this._retries = 0;
    this._cbTrips = 0;
    this._bhRejects = 0;
    this._rlRejects = 0;
    this._fallbacks = 0;
    this._writes = 0;
    this._latencySum = 0;
    this._startTime = Date.now();
  }
}

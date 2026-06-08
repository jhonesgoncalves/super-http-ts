import { Controller, Get } from '@nestjs/common';
import { SuperHttpService } from 'super-http/nestjs';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  http: {
    requests:    number;
    errors:      number;
    successRate: string;
    p99:         string;
  };
}

/**
 * HealthController — exposes a `/health` endpoint that returns live metrics
 * from the default SuperHttpService client.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly http: SuperHttpService) {}

  @Get()
  check(): HealthStatus {
    const m = this.http.metrics();

    const total     = m.totalRequests;
    const errors    = m.totalErrors;
    const rate      = total > 0 ? (((total - errors) / total) * 100).toFixed(1) : '100.0';
    const p99Ms     = m.p99 != null ? `${m.p99.toFixed(1)}ms` : 'N/A';
    const isDegraded = total > 10 && parseFloat(rate) < 95;

    return {
      status:    isDegraded ? 'degraded' : 'ok',
      uptime:    process.uptime(),
      timestamp: new Date().toISOString(),
      http: {
        requests:    total,
        errors,
        successRate: `${rate}%`,
        p99:         p99Ms,
      },
    };
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { SuperHttpService } from 'super-http/nestjs';

const mockSuperHttpService = {
  metrics: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers:   [{ provide: SuperHttpService, useValue: mockSuperHttpService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns status ok when success rate is high', () => {
    mockSuperHttpService.metrics.mockReturnValue({
      totalRequests: 100,
      totalErrors: 2,
      p99: 145.2,
    });

    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.http.successRate).toBe('98.0%');
    expect(result.http.p99).toBe('145.2ms');
    expect(result.http.requests).toBe(100);
    expect(result.http.errors).toBe(2);
    expect(typeof result.uptime).toBe('number');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns status degraded when error rate is above 5%', () => {
    mockSuperHttpService.metrics.mockReturnValue({
      totalRequests: 100,
      totalErrors: 10,
      p99: 300,
    });

    const result = controller.check();

    expect(result.status).toBe('degraded');
    expect(result.http.successRate).toBe('90.0%');
  });

  it('returns 100% success rate when no requests have been made', () => {
    mockSuperHttpService.metrics.mockReturnValue({
      totalRequests: 0,
      totalErrors: 0,
      p99: null,
    });

    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.http.successRate).toBe('100.0%');
    expect(result.http.p99).toBe('N/A');
  });

  it('does not mark degraded when total requests is below threshold (<=10)', () => {
    mockSuperHttpService.metrics.mockReturnValue({
      totalRequests: 5,
      totalErrors: 4, // 20% success — but total <= 10, not enough data
      p99: null,
    });

    const result = controller.check();

    expect(result.status).toBe('ok');
  });
});

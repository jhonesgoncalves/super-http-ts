import { AxiosInstance, AxiosResponse } from 'axios';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
}

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  isOpen = false;

  constructor(
    private readonly axiosInstance: AxiosInstance,
    private readonly circuitBreakerConfig: CircuitBreakerConfig,
  ) {}

  async execute<T>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    if (this.isOpen) {
      console.log('open');
      if (this.shouldAttemptReset()) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const response = await fn();

      console.log('entrou aqui');
      this.handleSuccess();

      return response;
    } catch (error) {
      this.handleFailure();

      throw error;
    }
  }

  private handleSuccess() {
    this.successes++;

    if (this.successes >= this.circuitBreakerConfig.successThreshold) {
      this.reset();
    }
  }

  private handleFailure() {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailureTime;

    if (timeSinceLastFailure >= this.circuitBreakerConfig.timeoutMs) {
      this.failures = 1;
    } else {
      this.failures++;
    }

    this.lastFailureTime = now;
    console.log(`failures: ${this.failures}`);
    console.log(`failureThreshold: ${this.circuitBreakerConfig.failureThreshold}`);

    if (this.failures >= this.circuitBreakerConfig.failureThreshold) {
      this.trip();
    }
  }

  private trip() {
    this.isOpen = true;
    this.lastFailureTime = Date.now();
  }

  private reset() {
    this.successes = 0;
    this.failures = 0;
    this.isOpen = false;
  }

  private shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.circuitBreakerConfig.timeoutMs;
  }
}

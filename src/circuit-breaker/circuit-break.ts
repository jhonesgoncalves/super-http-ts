import { AxiosResponse } from 'axios';

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
  private circuitBreakerConfig?: CircuitBreakerConfig | any;

  constructor() {}

  public setConfig(config: CircuitBreakerConfig) {
    this.circuitBreakerConfig = config;
  }

  async execute<T>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    if (this.isOpen) {
      if (this.shouldAttemptReset()) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const response = await fn();
      this.handleSuccess();

      return response;
    } catch (error) {
      this.handleFailure();

      throw error;
    }
  }

  public handleIsOpen(): boolean {
    if (this.isOpen) {
      if (this.shouldAttemptReset()) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    return this.isOpen;
  }

  private handleSuccess() {
    this.successes++;

    if (this.successes >= this.circuitBreakerConfig?.successThreshold) {
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

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from '../circuit-breaker/circuit-break';
import { CircuitBreakerFactory } from '../circuit-breaker/circuit-breaker.factory';

interface RetryConfig {
  retries: number;
  delayMs: number;
}

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private retryConfig?: RetryConfig;
  private circuitBreakerConfig?: CircuitBreakerConfig;
  private circuitBreaker?: CircuitBreaker;
  private baseURL: string;

  constructor(baseURL: string, axiosConfig: AxiosRequestConfig = {}) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      ...axiosConfig,
      baseURL,
    });
  }

  retry(retries: number, delayMs: number): this {
    this.retryConfig = {
      retries,
      delayMs,
    };
    return this;
  }

  circuitBreak(config: CircuitBreakerConfig): this {
    this.circuitBreakerConfig = config;
    return this;
  }

  request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    let requestFn = () => this.axiosInstance.request(config);

    if (this.circuitBreakerConfig) {
      requestFn = this.withCircuitBreaker(requestFn, this.circuitBreakerConfig);
    }

    if (this.retryConfig) {
      requestFn = this.withRetry(requestFn, this.retryConfig);
    }

    return requestFn();
  }

  private withRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    retryConfig: RetryConfig,
  ): () => Promise<AxiosResponse<T>> {
    return async () => {
      let retries = 0;

      while (true) {
        try {
          if (this.circuitBreaker?.isOpen) {
            throw new Error('Circuit breaker is open');
          }
          return await requestFn();
        } catch (error) {
          if (retries >= retryConfig.retries) {
            throw error;
          }
          if (this.circuitBreaker?.isOpen) {
            throw new Error('Circuit breaker is open');
          }
          console.log('retry', retries);
          retries++;
          await new Promise((resolve) => setTimeout(resolve, retryConfig.delayMs));
        }
      }
    };
  }

  private withCircuitBreaker<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    circuitBreakerConfig: CircuitBreakerConfig,
  ): () => Promise<AxiosResponse<T> | any> {
    this.circuitBreaker = CircuitBreakerFactory.create(this.baseURL, this.axiosInstance, circuitBreakerConfig);

    return async () => {
      if (this.circuitBreaker?.isOpen) {
        throw new Error('Circuit breaker is open');
      }

      return this.circuitBreaker?.execute(requestFn);
    };
  }
}

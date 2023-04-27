import axios, { AxiosInstance } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from '../circuit-breaker/circuit-break';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { HttpClientResponse } from '../models/http.client.response';

interface RetryConfig {
  retries: number;
  delayMs: number;
}

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private retryConfig?: RetryConfig;
  private circuitBreakerConfig?: CircuitBreakerConfig;
  private circuitBreaker?: CircuitBreaker;

  constructor(baseURL: string, httpClientRequestConfig: HttpClientRequestConfig = {}, circuitBreaker?: CircuitBreaker) {
    this.circuitBreaker = circuitBreaker;
    this.axiosInstance = axios.create({
      ...httpClientRequestConfig,
      baseURL,
      timeout: 1000,
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

  request<T = any>(config: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
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
    requestFn: () => Promise<HttpClientResponse<T>>,
    retryConfig: RetryConfig,
  ): () => Promise<HttpClientResponse<T>> {
    return async () => {
      let retries = 0;

      if (this.circuitBreaker?.handleIsOpen()) {
        throw new Error('Circuit breaker is open');
      }

      while (true) {
        try {
          return await requestFn();
        } catch (error) {
          if (retries >= retryConfig.retries) {
            throw error;
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, retryConfig.delayMs));
        }
      }
    };
  }

  private withCircuitBreaker<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    circuitBreakerConfig: CircuitBreakerConfig,
  ): () => Promise<HttpClientResponse<T> | any> {
    if (!this.circuitBreaker) this.circuitBreaker = new CircuitBreaker();

    this.circuitBreaker.setConfig(circuitBreakerConfig);

    return async () => {
      return this.circuitBreaker?.execute(requestFn);
    };
  }
}

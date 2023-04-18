import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from './circut-break';

interface RetryConfig {
  retries: number;
  delayMs: number;
}

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private retryConfig?: RetryConfig;
  private circuitBreakerConfig?: CircuitBreakerConfig;
  private circuitBreaker?: CircuitBreaker;

  constructor(baseURL: string, axiosConfig: AxiosRequestConfig = {}) {
    this.axiosInstance = axios.create({
      ...axiosConfig,
      baseURL,
    });
  }

  private static instance: HttpClient;
  public static getInstance(baseURL: string, axiosConfig: AxiosRequestConfig = {}): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient(baseURL, axiosConfig);
    }
    return HttpClient.instance;
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
    this.circuitBreaker = CircuitBreaker.getInstance(this.axiosInstance, circuitBreakerConfig);

    return async () => {
      if (this.circuitBreaker?.isOpen) {
        throw new Error('Circuit breaker is open');
      }

      return this.circuitBreaker?.execute(requestFn);
    };
  }
}

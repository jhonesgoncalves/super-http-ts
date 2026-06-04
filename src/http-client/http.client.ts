import http from 'http';
import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CircuitBreakerConfig, CircuitBreaker } from '../circuit-breaker/circuit-break';
import { HttpClientRequestConfig } from '../models/http.client.request.config';
import { HttpClientResponse } from '../models/http.client.response';

interface RetryConfig {
  retries: number;
  delayMs: number;
  retryOn?: number[];
}

export interface PoolConfig {
  maxSockets?: number;
  maxFreeSockets?: number;
  keepAlive?: boolean;
  keepAliveMsecs?: number;
  timeout?: number;
}

const SOCKET_ERRORS = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);

function isRetryableError(error: any): boolean {
  if (error?.code && SOCKET_ERRORS.has(error.code)) return true;
  if (error?.response?.status >= 500) return true;
  return false;
}

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private retryConfig?: RetryConfig;
  private circuitBreakerConfig?: CircuitBreakerConfig;
  private circuitBreaker?: CircuitBreaker;

  constructor(
    baseURL: string,
    httpClientRequestConfig: HttpClientRequestConfig = {},
    circuitBreaker?: CircuitBreaker,
    poolConfig: PoolConfig = {},
  ) {
    this.circuitBreaker = circuitBreaker;

    const {
      maxSockets = 50,
      maxFreeSockets = 10,
      keepAlive = true,
      keepAliveMsecs = 1000,
      timeout,
    } = poolConfig;

    const httpAgent = new http.Agent({ maxSockets, maxFreeSockets, keepAlive, keepAliveMsecs });
    const httpsAgent = new https.Agent({ maxSockets, maxFreeSockets, keepAlive, keepAliveMsecs });

    this.axiosInstance = axios.create({
      ...httpClientRequestConfig,
      baseURL,
      timeout: timeout ?? httpClientRequestConfig.timeout ?? 30000,
      httpAgent,
      httpsAgent,
    });
  }

  retry(retries: number, delayMs: number, retryOn?: number[]): this {
    this.retryConfig = { retries, delayMs, retryOn };
    return this;
  }

  circuitBreak(config: CircuitBreakerConfig): this {
    this.circuitBreakerConfig = config;
    return this;
  }

  get<T = any>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'get' });
  }

  post<T = any>(url: string, data?: any, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'post', data });
  }

  put<T = any>(url: string, data?: any, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'put', data });
  }

  patch<T = any>(url: string, data?: any, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'patch', data });
  }

  delete<T = any>(url: string, config?: HttpClientRequestConfig): Promise<HttpClientResponse<T>> {
    return this.request<T>({ ...config, url, method: 'delete' });
  }

  request<T = any>(config: AxiosRequestConfig): Promise<HttpClientResponse<T>> {
    let requestFn: () => Promise<HttpClientResponse<T>> = () => this.axiosInstance.request<T>(config);

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
      let attempt = 0;

      while (true) {
        try {
          return await requestFn();
        } catch (error: any) {
          const isCircuitOpen = error?.message === 'Circuit breaker is open';

          if (isCircuitOpen || attempt >= retryConfig.retries) {
            throw error;
          }

          const shouldRetry = retryConfig.retryOn
            ? retryConfig.retryOn.includes(error?.response?.status)
            : isRetryableError(error);

          if (!shouldRetry) throw error;

          attempt++;
          await new Promise((resolve) => setTimeout(resolve, retryConfig.delayMs));
        }
      }
    };
  }

  private withCircuitBreaker<T>(
    requestFn: () => Promise<HttpClientResponse<T>>,
    circuitBreakerConfig: CircuitBreakerConfig,
  ): () => Promise<HttpClientResponse<T>> {
    if (!this.circuitBreaker) this.circuitBreaker = new CircuitBreaker();
    this.circuitBreaker.setConfig(circuitBreakerConfig);

    return () => this.circuitBreaker!.execute(requestFn);
  }
}

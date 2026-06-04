import { HttpClient, PoolConfig } from './http.client';
import { CircuitBreaker } from '../circuit-breaker/circuit-break';
import { HttpClientRequestConfig } from '../models/http.client.request.config';

export class HttpClientFactory {
  private static instances: Map<string, HttpClient> = new Map();

  static create(baseURL: string, httpConfig?: HttpClientRequestConfig, poolConfig?: PoolConfig): HttpClient {
    const existing = HttpClientFactory.instances.get(baseURL);
    if (existing) return existing;

    const circuitBreaker = new CircuitBreaker();
    const instance = new HttpClient(baseURL, httpConfig, circuitBreaker, poolConfig);
    HttpClientFactory.instances.set(baseURL, instance);

    return instance;
  }

  static clear(): void {
    HttpClientFactory.instances.clear();
  }
}

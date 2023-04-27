import { HttpClient } from './http.client';
import { CircuitBreaker } from '../circuit-breaker/circuit-break';
import { HttpClientRequestConfig } from '../models/http.client.request.config';

export class HttpClientFactory {
  private static instances: Map<string, HttpClient> = new Map();

  static create(baseURL: string, httpConfig?: HttpClientRequestConfig): HttpClient {
    const instance = HttpClientFactory.instances.get(baseURL);
    if (!instance) {
      const circuitBreak = new CircuitBreaker();
      const newInstance = new HttpClient(baseURL, httpConfig, circuitBreak);
      HttpClientFactory.instances.set(baseURL, newInstance);

      return newInstance;
    }
    return instance;
  }
}

import { AxiosInstance } from 'axios';
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-break';

export class CircuitBreakerFactory {
  private static instances: Map<string, CircuitBreaker> = new Map();

  static create(
    baseURL: string,
    axiosInstance: AxiosInstance,
    circuitBreakerConfig: CircuitBreakerConfig,
  ): CircuitBreaker {
    const instance = CircuitBreakerFactory.instances.get(baseURL);
    if (!instance) {
      const newInstance = new CircuitBreaker(axiosInstance, circuitBreakerConfig);
      CircuitBreakerFactory.instances.set(baseURL, newInstance);
      console.log('newInstance', newInstance);
      return newInstance;
    }
    return instance;
  }
}

import { AxiosRequestConfig } from 'axios';
import { HttpClient } from './http.client';

export class HttpClientFactory {
  private static instances: Map<string, HttpClient> = new Map();

  static create(baseURL: string, axiosConfig?: AxiosRequestConfig): HttpClient {
    const instance = HttpClientFactory.instances.get(baseURL);
    // console.log(this.instances);
    // console.log('instance', instance);
    if (!instance) {
      const newInstance = new HttpClient(baseURL, axiosConfig);
      HttpClientFactory.instances.set(baseURL, newInstance);
      console.log('newInstance', newInstance);
      return newInstance;
    }
    return instance;
  }
}

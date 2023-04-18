import { AxiosRequestConfig } from 'axios';
import { HttpClient } from './http.client';

export class HttpClientFactory {
  private static instance: HttpClient;

  static create(baseURL: string, axiosConfig?: AxiosRequestConfig): HttpClient {
    if (!HttpClientFactory.instance) {
      HttpClientFactory.instance = new HttpClient(baseURL, axiosConfig);
    }

    return HttpClientFactory.instance;
  }
}

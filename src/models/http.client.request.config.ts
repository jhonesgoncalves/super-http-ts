import { AxiosRequestConfig } from 'axios';
import type { RequestPolicy } from '../http-client/http.client';

export interface HttpClientRequestConfig extends AxiosRequestConfig {
  policy?: RequestPolicy;
}

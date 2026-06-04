import axios from 'axios';
import { HttpClient } from '../http-client/http.client';
import { HttpClientFactory } from '../http-client/http.factory';
import { CircuitBreaker } from '../circuit-breaker/circuit-break';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockAxiosInstance = {
  request: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  HttpClientFactory.clear();
});

describe('HttpClient', () => {
  describe('basic requests', () => {
    it('makes a GET request', async () => {
      mockAxiosInstance.request.mockResolvedValue({ status: 200, data: { ok: true } });
      const client = new HttpClient('https://api.example.com');
      const res = await client.get('/test');
      expect(res.status).toBe(200);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/test', method: 'get' }));
    });

    it('makes a POST request with data', async () => {
      mockAxiosInstance.request.mockResolvedValue({ status: 201, data: { id: 1 } });
      const client = new HttpClient('https://api.example.com');
      const res = await client.post('/users', { name: 'Alice' });
      expect(res.status).toBe(201);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/users', method: 'post', data: { name: 'Alice' } }),
      );
    });

    it('makes PUT, PATCH and DELETE requests', async () => {
      mockAxiosInstance.request.mockResolvedValue({ status: 200, data: {} });
      const client = new HttpClient('https://api.example.com');
      await client.put('/users/1', { name: 'Bob' });
      await client.patch('/users/1', { name: 'Bob' });
      await client.delete('/users/1');
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });
  });

  describe('retry', () => {
    it('retries on ECONNRESET and succeeds', async () => {
      const networkError = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
      mockAxiosInstance.request
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({ status: 200, data: 'ok' });

      const client = new HttpClient('https://api.example.com');
      client.retry(3, 0);
      const res = await client.get('/test');
      expect(res.status).toBe(200);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });

    it('retries on 5xx errors', async () => {
      const serverError = { response: { status: 503 } };
      mockAxiosInstance.request.mockRejectedValueOnce(serverError).mockResolvedValue({ status: 200, data: 'ok' });

      const client = new HttpClient('https://api.example.com');
      client.retry(2, 0);
      const res = await client.get('/test');
      expect(res.status).toBe(200);
    });

    it('throws after exhausting retries', async () => {
      const networkError = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
      mockAxiosInstance.request.mockRejectedValue(networkError);

      const client = new HttpClient('https://api.example.com');
      client.retry(2, 0);
      await expect(client.get('/test')).rejects.toMatchObject({ code: 'ECONNRESET' });
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });

    it('does not retry on 4xx errors', async () => {
      const clientError = { response: { status: 404 } };
      mockAxiosInstance.request.mockRejectedValue(clientError);

      const client = new HttpClient('https://api.example.com');
      client.retry(3, 0);
      await expect(client.get('/not-found')).rejects.toEqual(clientError);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('circuit breaker', () => {
    it('opens after reaching failure threshold', async () => {
      const error = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
      mockAxiosInstance.request.mockRejectedValue(error);

      const client = new HttpClient('https://api.example.com');
      client.circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 60000 });

      await expect(client.request({ url: '/' })).rejects.toThrow();
      await expect(client.request({ url: '/' })).rejects.toThrow();
      await expect(client.request({ url: '/' })).rejects.toThrow('Circuit breaker is open');
    });

    it('resets after timeout', async () => {
      const error = Object.assign(new Error('fail'), { code: 'ECONNRESET' });
      mockAxiosInstance.request
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ status: 200, data: 'recovered' });

      const cb = new CircuitBreaker();
      const client = new HttpClient('https://api.example.com', {}, cb);
      client.circuitBreak({ failureThreshold: 2, successThreshold: 1, timeoutMs: 0 });

      await expect(client.request({ url: '/' })).rejects.toThrow();
      await expect(client.request({ url: '/' })).rejects.toThrow();

      cb['lastFailureTime'] = Date.now() - 1;
      const res = await client.request({ url: '/' });
      expect(res.status).toBe(200);
    });
  });
});

describe('HttpClientFactory', () => {
  it('returns the same instance for the same baseURL', () => {
    const a = HttpClientFactory.create('https://api.example.com');
    const b = HttpClientFactory.create('https://api.example.com');
    expect(a).toBe(b);
  });

  it('returns different instances for different baseURLs', () => {
    const a = HttpClientFactory.create('https://api.example.com');
    const b = HttpClientFactory.create('https://other.example.com');
    expect(a).not.toBe(b);
  });
});

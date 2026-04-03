import { type HttpClientInterface } from './HttpClientInterface.js';

export class FetchHttpClient implements HttpClientInterface {
  async request(method: string, url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...options, method });
  }
}

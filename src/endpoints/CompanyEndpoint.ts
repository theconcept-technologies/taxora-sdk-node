import { HttpException } from '../exceptions/HttpException.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';

export class CompanyEndpoint {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly httpClient: HttpClientInterface,
  ) {}

  async get(): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };

    const token = this.tokenStorage.get();
    if (token) {
      headers['Authorization'] = `Bearer ${token.accessToken}`;
    }

    const response = await this.httpClient.request('GET', `${this.baseUrl}/company`, { headers });
    const responseText = await response.text();

    if (!response.ok) {
      throw new HttpException(`HTTP error ${response.status}`, response.status, responseText);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new HttpException('Invalid JSON response', 0, responseText);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new HttpException('Unexpected response format', 0, responseText);
    }

    const obj = parsed as Record<string, unknown>;
    if (obj['data'] !== undefined && typeof obj['data'] === 'object' && obj['data'] !== null) {
      return obj['data'] as Record<string, unknown>;
    }

    return obj;
  }
}

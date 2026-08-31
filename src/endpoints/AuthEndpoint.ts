import { hostname } from 'os';
import { Token } from '../dto/Token.js';
import { LoginIdentifier } from '../enums/LoginIdentifier.js';
import { AuthenticationException } from '../exceptions/AuthenticationException.js';
import { HttpException } from '../exceptions/HttpException.js';
import { describeApiError } from '../exceptions/apiErrorMessage.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { RetryPolicy } from '../http/RetryPolicy.js';
import { withRetries } from '../http/withRetries.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';

export class AuthEndpoint {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly httpClient: HttpClientInterface,
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
  ) {}

  async login(
    identifier: string,
    password: string,
    device?: string,
    loginIdentifier: LoginIdentifier = LoginIdentifier.EMAIL,
  ): Promise<Token> {
    const deviceName = device ?? hostname();

    const body: Record<string, string> = {
      identifier: loginIdentifier,
      password,
      device_name: deviceName,
    };

    if (loginIdentifier === LoginIdentifier.CLIENT_ID) {
      body['client_id'] = identifier;
    } else {
      body['email'] = identifier;
    }

    const data = await withRetries(this.retryPolicy, 'login', async () => {
      const response = await this.httpClient.request('POST', `${this.baseUrl}/auth/login`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();

      if (response.status === 401) {
        throw new AuthenticationException('Authentication failed: invalid credentials', {
          status: 401,
          body: responseText,
        });
      }

      if (!response.ok) {
        throw new HttpException(
        describeApiError(responseText, response.status),
        response.status,
        responseText,
        {},
        response.headers.get('retry-after'),
      );
      }

      return this.parseResponse(responseText, response.status);
    });

    const token = Token.fromArray(data);
    this.tokenStorage.set(token);
    return token;
  }

  async loginWithClientId(clientId: string, password: string, device?: string): Promise<Token> {
    return this.login(clientId, password, device, LoginIdentifier.CLIENT_ID);
  }

  async refresh(): Promise<Token> {
    const storedToken = this.tokenStorage.get();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };

    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken.accessToken}`;
    }

    const data = await withRetries(this.retryPolicy, 'token refresh', async () => {
      const response = await this.httpClient.request('POST', `${this.baseUrl}/auth/refresh`, { headers });
      const responseText = await response.text();

      if (response.status === 401) {
        throw new AuthenticationException('Token refresh failed: unauthorized', { status: 401, body: responseText });
      }

      if (!response.ok) {
        throw new HttpException(
        describeApiError(responseText, response.status),
        response.status,
        responseText,
        {},
        response.headers.get('retry-after'),
      );
      }

      return this.parseResponse(responseText, response.status);
    });

    const token = Token.fromArray(data);
    this.tokenStorage.set(token);
    return token;
  }

  private parseResponse(responseText: string, statusCode: number): Record<string, unknown> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new HttpException('Invalid JSON response', statusCode, responseText);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new HttpException('Unexpected response format', statusCode, responseText);
    }

    const obj = parsed as Record<string, unknown>;
    if (obj['data'] !== undefined && typeof obj['data'] === 'object' && obj['data'] !== null) {
      return obj['data'] as Record<string, unknown>;
    }

    return obj;
  }
}

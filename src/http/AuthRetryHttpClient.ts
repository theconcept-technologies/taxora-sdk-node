import { type Token } from '../dto/Token.js';
import { AuthenticationException } from '../exceptions/AuthenticationException.js';
import { type HttpClientInterface } from './HttpClientInterface.js';
import { type TokenStorageInterface } from './TokenStorageInterface.js';

const AUTH_PATH_PATTERN = /\/auth\//;

/**
 * HTTP client wrapper that handles:
 * - Preemptive token refresh when the stored token is expired
 * - Automatic retry with a fresh token on 401 responses
 * - Passthrough for /auth/ routes (no interception)
 */
export class AuthRetryHttpClient implements HttpClientInterface {
  constructor(
    private readonly inner: HttpClientInterface,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly refreshFn: () => Promise<Token>,
  ) {}

  async request(method: string, url: string, options?: RequestInit): Promise<Response> {
    // Auth routes bypass all retry logic
    if (AUTH_PATH_PATTERN.test(url)) {
      return this.inner.request(method, url, options);
    }

    // Preemptive refresh if token is expired
    const currentToken = this.tokenStorage.get();
    if (currentToken?.isExpired()) {
      await this.refreshFn();
    }

    // Build request with potentially refreshed token
    const updatedOptions = this.injectAuthHeader(options);
    const response = await this.inner.request(method, url, updatedOptions);

    // 401: refresh once and retry
    if (response.status === 401) {
      await this.refreshFn();
      const retryOptions = this.injectAuthHeader(options);
      const retryResponse = await this.inner.request(method, url, retryOptions);

      if (retryResponse.status === 401) {
        const body = await retryResponse.text();
        throw new AuthenticationException('Authentication failed after token refresh', { status: 401, body });
      }

      return retryResponse;
    }

    return response;
  }

  private injectAuthHeader(options?: RequestInit): RequestInit {
    const token = this.tokenStorage.get();
    if (!token) return options ?? {};

    const existing = options?.headers ?? {};
    const headers = { ...(existing as Record<string, string>), Authorization: `Bearer ${token.accessToken}` };
    return { ...(options ?? {}), headers };
  }
}

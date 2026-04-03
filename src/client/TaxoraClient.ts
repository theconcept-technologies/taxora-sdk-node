import { AuthEndpoint } from '../endpoints/AuthEndpoint.js';
import { CompanyEndpoint } from '../endpoints/CompanyEndpoint.js';
import { VatEndpoint } from '../endpoints/VatEndpoint.js';
import { Environment, getBaseUrl } from '../enums/Environment.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { FetchHttpClient } from '../http/FetchHttpClient.js';
import { InMemoryTokenStorage } from '../http/InMemoryTokenStorage.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';
import { AuthRetryHttpClient } from '../http/AuthRetryHttpClient.js';

export interface TaxoraClientOptions {
  apiKey: string;
  environment?: Environment;
  tokenStorage?: TokenStorageInterface;
  httpClient?: HttpClientInterface;
}

export class TaxoraClient {
  public readonly auth: AuthEndpoint;
  public readonly vat: VatEndpoint;
  public readonly company: CompanyEndpoint;
  public readonly baseUrl: string;

  constructor(options: TaxoraClientOptions) {
    const environment = options.environment ?? Environment.SANDBOX;
    const tokenStorage = options.tokenStorage ?? new InMemoryTokenStorage();
    const httpClient = options.httpClient ?? new FetchHttpClient();

    this.baseUrl = getBaseUrl(environment);

    // Auth endpoint uses the raw HTTP client — no retry interception for auth routes
    this.auth = new AuthEndpoint(this.baseUrl, options.apiKey, tokenStorage, httpClient);

    // All other endpoints use the retry-capable client that handles 401 auto-refresh
    const retryClient = new AuthRetryHttpClient(httpClient, tokenStorage, () => this.auth.refresh());

    this.vat = new VatEndpoint(this.baseUrl, options.apiKey, tokenStorage, retryClient);
    this.company = new CompanyEndpoint(this.baseUrl, options.apiKey, tokenStorage, retryClient);
  }
}

import { AuthEndpoint } from '../endpoints/AuthEndpoint.js';
import { CompanyEndpoint } from '../endpoints/CompanyEndpoint.js';
import { EReportingEndpoint } from '../endpoints/EReportingEndpoint.js';
import { SmartEnrichmentEndpoint } from '../endpoints/SmartEnrichmentEndpoint.js';
import { VatEndpoint } from '../endpoints/VatEndpoint.js';
import { Environment, getBaseUrl } from '../enums/Environment.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { FetchHttpClient } from '../http/FetchHttpClient.js';
import { InMemoryTokenStorage } from '../http/InMemoryTokenStorage.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';
import { AuthRetryHttpClient } from '../http/AuthRetryHttpClient.js';
import { SdkVersionHttpClient } from '../http/SdkVersionHttpClient.js';
import { RetryPolicy } from '../http/RetryPolicy.js';

export interface TaxoraClientOptions {
  apiKey: string;
  environment?: Environment;
  tokenStorage?: TokenStorageInterface;
  httpClient?: HttpClientInterface;
  /** Retry behaviour for transient gateway failures; defaults to 3 attempts with backoff. */
  retryPolicy?: RetryPolicy;
}

export class TaxoraClient {
  public readonly auth: AuthEndpoint;
  public readonly vat: VatEndpoint;
  public readonly company: CompanyEndpoint;
  public readonly smartEnrichment: SmartEnrichmentEndpoint;
  public readonly eReporting: EReportingEndpoint;
  public readonly baseUrl: string;

  constructor(options: TaxoraClientOptions) {
    const environment = options.environment ?? Environment.SANDBOX;
    const tokenStorage = options.tokenStorage ?? new InMemoryTokenStorage();
    const httpClient = options.httpClient ?? new FetchHttpClient();
    const retryPolicy = options.retryPolicy ?? new RetryPolicy();

    // Wrap the transport so every request carries the SDK version header.
    const versionedClient = new SdkVersionHttpClient(httpClient);

    this.baseUrl = getBaseUrl(environment);

    // Auth endpoint uses the version-stamped client directly — no retry interception for auth routes
    this.auth = new AuthEndpoint(this.baseUrl, options.apiKey, tokenStorage, versionedClient, retryPolicy);

    // All other endpoints use the retry-capable client that handles 401 auto-refresh
    const retryClient = new AuthRetryHttpClient(versionedClient, tokenStorage, () => this.auth.refresh());

    this.vat = new VatEndpoint(this.baseUrl, options.apiKey, tokenStorage, retryClient, retryPolicy);
    this.company = new CompanyEndpoint(this.baseUrl, options.apiKey, tokenStorage, retryClient, retryPolicy);
    this.smartEnrichment = new SmartEnrichmentEndpoint(
      this.baseUrl,
      options.apiKey,
      tokenStorage,
      retryClient,
      retryPolicy,
    );
    this.eReporting = new EReportingEndpoint(this.baseUrl, options.apiKey, tokenStorage, retryClient, retryPolicy);
  }
}

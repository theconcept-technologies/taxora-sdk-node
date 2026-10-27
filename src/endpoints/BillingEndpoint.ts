import { UsageSummary, UsageSummaryPage } from '../dto/UsageSummary.js';
import { HttpException } from '../exceptions/HttpException.js';
import { describeApiError } from '../exceptions/apiErrorMessage.js';
import { TaxoraException } from '../exceptions/TaxoraException.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { RetryPolicy } from '../http/RetryPolicy.js';
import { withRetries } from '../http/withRetries.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Billing transparency: read-only usage summaries of the company's billable
 * modules (E-Reporting / E-Invoicing, Smart Enrichment). Requires one of those
 * modules on the account (403 otherwise). Every call is a GET, so transient
 * gateway failures are retried (see RetryPolicy).
 */
export class BillingEndpoint {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly httpClient: HttpClientInterface,
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
  ) {}

  /** Paginated usage summaries, newest billing period first. `perPage` is clamped to 1-100 server-side. */
  async listUsageSummaries(page = 1, perPage = 25): Promise<UsageSummaryPage> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const data = await this.getJson(`${this.baseUrl}/billing/usage-summaries?${params.toString()}`);
    return UsageSummaryPage.fromResponse(data);
  }

  /**
   * The usage summaries of one billing period (YYYY-MM), one per feature,
   * each with its usage events. A period without usage yields a 404 (HttpException).
   */
  async getUsageSummaries(period: string): Promise<UsageSummary[]> {
    if (!PERIOD_REGEX.test(period)) {
      throw new TaxoraException(`Invalid billing period "${period}". Expected YYYY-MM, e.g. "2026-09".`);
    }

    const data = await this.getJson(`${this.baseUrl}/billing/usage-summaries/${period}`);
    return Array.isArray(data)
      ? data
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map(UsageSummary.fromArray)
      : [];
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };
    const token = this.tokenStorage.get();
    if (token) {
      headers['Authorization'] = `Bearer ${token.accessToken}`;
    }
    return headers;
  }

  /** GET + envelope unwrap (`{success, data}` → data, which may be an object or an array). */
  private async getJson(url: string): Promise<unknown> {
    return withRetries(this.retryPolicy, 'billing request', async () => {
      const response = await this.httpClient.request('GET', url, { headers: this.buildHeaders() });
      const responseText = await response.text();

      if (!response.ok) {
        throw new HttpException(
          describeApiError(responseText, response.status),
          response.status,
          responseText,
          {},
          response.headers.get('retry-after'),
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw new HttpException('Invalid JSON response', response.status, responseText);
      }

      if (typeof parsed !== 'object' || parsed === null) {
        throw new HttpException('Unexpected response format', response.status, responseText);
      }

      const obj = parsed as Record<string, unknown>;
      return obj['data'] !== undefined && obj['data'] !== null ? obj['data'] : obj;
    });
  }
}

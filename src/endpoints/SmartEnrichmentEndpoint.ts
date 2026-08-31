import { type SmartEnrichmentMode } from '../enums/SmartEnrichmentMode.js';
import { SmartEnrichmentJob } from '../dto/SmartEnrichmentJob.js';
import { SmartEnrichmentHistoryPage } from '../dto/SmartEnrichmentHistoryPage.js';
import { SmartEnrichmentStatistics, type SmartEnrichmentStatisticsInterval } from '../dto/SmartEnrichmentStatistics.js';
import { type SmartEnrichmentStatus } from '../enums/SmartEnrichmentStatus.js';
import { HttpException } from '../exceptions/HttpException.js';
import { describeApiError, jsonErrorMessage } from '../exceptions/apiErrorMessage.js';
import { TaxoraException } from '../exceptions/TaxoraException.js';
import { ValidationException } from '../exceptions/ValidationException.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { RetryPolicy } from '../http/RetryPolicy.js';
import { withResponseRetries } from '../http/withRetries.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';

const STATISTICS_INTERVALS: readonly SmartEnrichmentStatisticsInterval[] = ['day', 'week', 'month'];

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_TIMEOUT_MS = 120_000;

export interface SmartEnrichmentInput {
  companyName: string;
  country: string;
  street?: string;
  postalCode?: string;
  city?: string;
  /**
   * Search depth. Omit to use the server default (`default`). `complex` searches with two
   * independent providers and cross-checks them — better hit rate, higher cost per lookup.
   */
  mode?: SmartEnrichmentMode;
}

/** One recent monthly billing entry, exposed on the usage response for transparency. */
export interface SmartEnrichmentUsageHistoryEntry {
  /** Billing period, e.g. "2026-05". */
  period: string;
  matches: number;
  /** Amount due for the period as a decimal string, e.g. "9.60". */
  amount: string;
  state: 'billed' | 'pending';
  billingType: string | null;
  manualReference: string | null;
}

export interface SmartEnrichmentUsage {
  period: string;
  used: number;
  included: number;
  remaining: number;
  overageCount: number;
  overagePrice: number;
  overageAmount: number;
  hardCap: number | null;
  /** Recent monthly billing entries; empty when the API sends none. */
  history: SmartEnrichmentUsageHistoryEntry[];
}

export interface SmartEnrichmentExportOptions {
  /** Inclusive lower bound on the job's creation date (YYYY-MM-DD). */
  dateFrom?: string;
  /** Inclusive upper bound on the job's creation date (YYYY-MM-DD). */
  dateTo?: string;
  /** Only include rows with at least this result confidence (0–100). */
  minConfidence?: number;
  /** Only include rows with one of these item statuses (found, no_vat_exists, not_found). */
  status?: SmartEnrichmentStatus[];
  /** Only include rows that resolved to a VAT number. */
  onlyFound?: boolean;
}

export interface SmartEnrichmentStatisticsOptions {
  /** Inclusive lower bound (YYYY-MM-DD). Defaults to 12 months ago (server-side). */
  dateFrom?: string;
  /** Inclusive upper bound (YYYY-MM-DD). Defaults to today (server-side). */
  dateTo?: string;
  /** Time-series bucket size. Defaults to "month" server-side. */
  interval?: SmartEnrichmentStatisticsInterval;
}

export interface SmartEnrichmentWaitOptions {
  /** Delay between polls in milliseconds. Defaults to 2000. */
  pollIntervalMs?: number;
  /** Maximum total time to wait in milliseconds. Defaults to 120000. */
  timeoutMs?: number;
}

/**
 * Smart Enrichment — reverse VAT lookup (company name + address + country → VAT + confidence).
 *
 *   let job = await client.smartEnrichment.lookup({ companyName: 'Example GmbH', country: 'AT' });
 *   if (job.isProcessing()) job = await client.smartEnrichment.waitForCompletion(job.jobId);
 *   console.log(job.result()?.vatNumber);
 */
export class SmartEnrichmentEndpoint {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly httpClient: HttpClientInterface,
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
  ) {}

  /**
   * Single reverse lookup. Returns a confident result synchronously, or a `processing`
   * job (poll with get(job.jobId) or waitForCompletion(job.jobId)) when deeper resolution
   * is needed.
   */
  async lookup(input: SmartEnrichmentInput): Promise<SmartEnrichmentJob> {
    this.validateInput(input);

    const body: Record<string, unknown> = {
      companyName: input.companyName,
      country: input.country,
    };
    if (input.street !== undefined) body['street'] = input.street;
    if (input.postalCode !== undefined) body['postalCode'] = input.postalCode;
    if (input.city !== undefined) body['city'] = input.city;
    if (input.mode !== undefined) body['mode'] = input.mode;

    const response = await this.sendRequest('POST', `${this.baseUrl}/smart-enrichment`, body);
    const data = await this.parseJsonResponse(response, [200, 202]);
    return SmartEnrichmentJob.fromArray(data);
  }

  /**
   * Bulk batch — always async. Returns a `processing` job; results arrive via the
   * `enrichment.completed` webhook and are retrievable via get(job.jobId).
   *
   * @param mode Search depth for every row in the batch. A row carrying its own `mode` overrides
   *             it, so a caller can pay for `complex` on just the rows that need it.
   */
  async bulkLookup(items: SmartEnrichmentInput[], mode?: SmartEnrichmentMode): Promise<SmartEnrichmentJob> {
    if (items.length === 0) {
      throw new TaxoraException('bulkLookup requires at least one item.');
    }
    items.forEach((item, index) => this.validateInput(item, `items[${index}]`));

    const body: Record<string, unknown> = { items };
    if (mode !== undefined) body['mode'] = mode;

    const response = await this.sendRequest('POST', `${this.baseUrl}/smart-enrichment/bulk`, body);
    const data = await this.parseJsonResponse(response, [200, 202]);
    return SmartEnrichmentJob.fromArray(data);
  }

  /** Poll a job (single or bulk) by its id. */
  async get(jobId: string): Promise<SmartEnrichmentJob> {
    this.validateJobId(jobId);

    const response = await this.sendRequest('GET', `${this.baseUrl}/smart-enrichment/${encodeURIComponent(jobId)}`);
    const data = await this.parseJsonResponse(response);
    return SmartEnrichmentJob.fromArray(data);
  }

  /**
   * Poll get(jobId) until the job is no longer processing (completed, failed or resolved).
   * Throws a TaxoraException when the job does not finish within `timeoutMs`.
   */
  async waitForCompletion(jobId: string, options: SmartEnrichmentWaitOptions = {}): Promise<SmartEnrichmentJob> {
    this.validateJobId(jobId);

    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
      throw new TaxoraException('pollIntervalMs must be greater than 0.');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TaxoraException('timeoutMs must be greater than 0.');
    }

    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = await this.get(jobId);
      if (!job.isProcessing()) {
        return job;
      }
      if (Date.now() + pollIntervalMs > deadline) {
        throw new TaxoraException(`Smart Enrichment job "${jobId}" did not complete within ${timeoutMs}ms.`, {
          jobId,
          timeoutMs,
        });
      }
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Paginated lookup history (newest first). `perPage` is capped at 100 server-side.
   * `search` filters (free-text) over the queried company name and the resolved
   * VAT number / matched company name.
   */
  async history(page = 1, perPage = 25, search?: string): Promise<SmartEnrichmentHistoryPage> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', String(perPage));
    if (search !== undefined) params.set('search', search);

    const response = await this.sendRequest('GET', `${this.baseUrl}/smart-enrichment/history?${params.toString()}`);
    // The history response is { data: [...], meta: {...}, stats: {...} }; parse it whole
    // rather than unwrapping `data` (which would drop the pagination meta).
    return SmartEnrichmentHistoryPage.fromResponse(await this.parseRawJson(response));
  }

  /** Current billing-period quota usage, plus recent monthly billing entries. */
  async usage(): Promise<SmartEnrichmentUsage> {
    const response = await this.sendRequest('GET', `${this.baseUrl}/smart-enrichment/usage`);
    const data = await this.parseJsonResponse(response);
    return {
      period: typeof data['period'] === 'string' ? data['period'] : '',
      used: typeof data['used'] === 'number' ? data['used'] : 0,
      included: typeof data['included'] === 'number' ? data['included'] : 0,
      remaining: typeof data['remaining'] === 'number' ? data['remaining'] : 0,
      overageCount: typeof data['overageCount'] === 'number' ? data['overageCount'] : 0,
      overagePrice: typeof data['overagePrice'] === 'number' ? data['overagePrice'] : 0,
      overageAmount: typeof data['overageAmount'] === 'number' ? data['overageAmount'] : 0,
      hardCap: typeof data['hardCap'] === 'number' ? data['hardCap'] : null,
      history: this.parseUsageHistory(data['history']),
    };
  }

  /**
   * Export the company's lookups as CSV (bulk-input shape plus the resolved VAT columns;
   * bulk jobs are flattened to one line per input row). Returns the raw CSV text
   * (UTF-8, BOM included by the API so Excel opens umlauts correctly).
   */
  async export(options: SmartEnrichmentExportOptions = {}): Promise<string> {
    const params = new URLSearchParams();
    if (options.dateFrom !== undefined) params.set('date_from', options.dateFrom);
    if (options.dateTo !== undefined) params.set('date_to', options.dateTo);
    if (options.minConfidence !== undefined) params.set('min_confidence', String(options.minConfidence));
    for (const status of options.status ?? []) {
      params.append('status[]', status);
    }
    if (options.onlyFound !== undefined) params.set('only_found', options.onlyFound ? '1' : '0');

    const queryString = params.toString();
    const url = `${this.baseUrl}/smart-enrichment/export${queryString ? `?${queryString}` : ''}`;

    const response = await this.sendRequest('GET', url);
    return this.parseCsvResponse(response);
  }

  /**
   * Aggregated lookup statistics: headline totals, a time series and breakdowns by
   * source, outcome and confidence band. The API defaults to the last 12 months
   * and a monthly interval.
   */
  async statistics(options: SmartEnrichmentStatisticsOptions = {}): Promise<SmartEnrichmentStatistics> {
    if (options.interval !== undefined && !STATISTICS_INTERVALS.includes(options.interval)) {
      throw new TaxoraException(
        `Invalid statistics interval "${String(options.interval)}". Expected one of: ${STATISTICS_INTERVALS.join(', ')}.`,
      );
    }

    const params = new URLSearchParams();
    if (options.dateFrom !== undefined) params.set('date_from', options.dateFrom);
    if (options.dateTo !== undefined) params.set('date_to', options.dateTo);
    if (options.interval !== undefined) params.set('interval', options.interval);

    const queryString = params.toString();
    const url = `${this.baseUrl}/smart-enrichment/statistics${queryString ? `?${queryString}` : ''}`;

    const response = await this.sendRequest('GET', url);
    // The statistics payload is a whole object (range/totals/breakdowns) — no `data` envelope.
    return SmartEnrichmentStatistics.fromArray(await this.parseRawJson(response));
  }

  // ---------------------------------------------------------------------
  // Input validation (fail fast, before any request is sent)
  // ---------------------------------------------------------------------

  private validateInput(input: SmartEnrichmentInput, context?: string): void {
    const where = context ? ` (${context})` : '';
    if (input.companyName.trim() === '') {
      throw new TaxoraException(`companyName must not be empty${where}.`);
    }
    if (input.country.length !== 2) {
      throw new TaxoraException(`country must be a 2-character ISO 3166-1 alpha-2 code${where}.`);
    }
  }

  private validateJobId(jobId: string): void {
    if (jobId.trim() === '') {
      throw new TaxoraException('jobId must not be empty.');
    }
  }

  // ---------------------------------------------------------------------
  // HTTP plumbing (kept in sync with VatEndpoint)
  // ---------------------------------------------------------------------

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

  private async sendRequest(method: string, url: string, body?: Record<string, unknown>): Promise<Response> {
    const options: RequestInit = { headers: this.buildHeaders() };
    if (body) options.body = JSON.stringify(body);

    const send = (): Promise<Response> => this.httpClient.request(method, url, options);

    // GETs are safe to repeat, so transient gateway failures are retried (see
    // RetryPolicy). Writes are not: a gateway timeout does not tell us whether
    // the API already processed them.
    return method === 'GET' ? withResponseRetries(this.retryPolicy, 'Smart Enrichment request', send) : send();
  }

  private async parseJsonResponse(
    response: Response,
    acceptedStatuses: number[] = [200],
  ): Promise<Record<string, unknown>> {
    const responseText = await response.text();

    if (response.status === 422) {
      throw new ValidationException(
        jsonErrorMessage(responseText) ?? 'Validation failed',
        this.parseValidationErrors(responseText),
      );
    }

    if (!response.ok && !acceptedStatuses.includes(response.status)) {
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
    if (obj['data'] !== undefined && (typeof obj['data'] === 'object' || Array.isArray(obj['data']))) {
      return obj['data'] as Record<string, unknown>;
    }

    return obj;
  }

  /**
   * Like parseJsonResponse but returns the whole object WITHOUT unwrapping `data` — used for
   * the paginated history response (where `data` is the row array and `meta`/`stats` must be
   * preserved) and the statistics response.
   */
  private async parseRawJson(response: Response): Promise<Record<string, unknown>> {
    const responseText = await response.text();

    if (response.status === 422) {
      throw new ValidationException(
        jsonErrorMessage(responseText) ?? 'Validation failed',
        this.parseValidationErrors(responseText),
      );
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new HttpException('Invalid JSON response', response.status, responseText);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new HttpException('Unexpected response format', response.status, responseText);
    }

    return parsed as Record<string, unknown>;
  }

  /**
   * For the CSV export: keeps the shared 422/HTTP error mapping but returns the body
   * verbatim (text/csv) instead of parsing JSON.
   */
  private async parseCsvResponse(response: Response): Promise<string> {
    const responseText = await response.text();

    if (response.status === 422) {
      throw new ValidationException(
        jsonErrorMessage(responseText) ?? 'Validation failed',
        this.parseValidationErrors(responseText),
      );
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

    return responseText;
  }

  private parseValidationErrors(responseText: string): Record<string, string[]> {
    try {
      const parsed = JSON.parse(responseText) as Record<string, unknown>;
      if (parsed['errors'] !== null && typeof parsed['errors'] === 'object' && !Array.isArray(parsed['errors'])) {
        return parsed['errors'] as Record<string, string[]>;
      }
    } catch {
      // ignore parse errors
    }
    return {};
  }

  private parseUsageHistory(value: unknown): SmartEnrichmentUsageHistoryEntry[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
      .map((row) => ({
        period: typeof row['period'] === 'string' ? row['period'] : '',
        matches: typeof row['matches'] === 'number' ? row['matches'] : 0,
        amount: typeof row['amount'] === 'string' ? row['amount'] : '0.00',
        state: row['state'] === 'billed' ? ('billed' as const) : ('pending' as const),
        billingType: typeof row['billingType'] === 'string' ? row['billingType'] : null,
        manualReference: typeof row['manualReference'] === 'string' ? row['manualReference'] : null,
      }));
  }
}

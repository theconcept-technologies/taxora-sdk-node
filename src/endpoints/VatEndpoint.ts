import { VatResource } from '../dto/VatResource.js';
import { VatCollection } from '../dto/VatCollection.js';
import { VatCertificateExport } from '../dto/VatCertificateExport.js';
import { VatValidationAddressInput } from '../dto/VatValidationAddressInput.js';
import {
  type LocalTaxNumberReportOptions,
  type LocalTaxNumberRow,
  type LocalTaxNumberSummary,
  parseLocalTaxNumbersCsv,
} from '../dto/LocalTaxNumberReport.js';
import { type Language } from '../enums/Language.js';
import { HttpException } from '../exceptions/HttpException.js';
import { describeApiError, jsonErrorMessage } from '../exceptions/apiErrorMessage.js';
import { ValidationException } from '../exceptions/ValidationException.js';
import { TaxoraException } from '../exceptions/TaxoraException.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { RetryPolicy } from '../http/RetryPolicy.js';
import { withRetries } from '../http/withRetries.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class VatEndpoint {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly httpClient: HttpClientInterface,
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
  ) {}

  async validate(
    vatUid: string,
    companyName?: string,
    provider?: string,
    addressInput?: VatValidationAddressInput | Record<string, string>,
  ): Promise<VatResource> {
    const body: Record<string, unknown> = { vat_uid: vatUid };
    if (companyName) body['company_name'] = companyName;
    if (provider) body['source'] = provider;

    if (addressInput) {
      body['address_input'] = addressInput instanceof VatValidationAddressInput ? addressInput.toArray() : addressInput;
    }

    // Read-only lookup, so transient gateway failures are retried (see RetryPolicy).
    return withRetries(this.retryPolicy, 'VAT validation', async () => {
      const response = await this.sendRequest('POST', `${this.baseUrl}/vat/validate`, body);
      const data = await this.parseJsonResponse(response);

      return VatResource.fromArray(data);
    });
  }

  async validateMultiple(vatUids: string[], companyNames?: string[], provider?: string): Promise<VatCollection> {
    const body: Record<string, unknown> = { vat_uids: vatUids };
    if (companyNames) body['company_names'] = companyNames;
    if (provider) body['source'] = provider;

    return withRetries(this.retryPolicy, 'VAT validation', async () => {
      const response = await this.sendRequest('POST', `${this.baseUrl}/vat/validate/multiple`, body);
      const data = await this.parseJsonResponse(response);

      return VatCollection.fromResponse(data);
    });
  }

  async validateSchema(vatUid: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { vat_uid: vatUid };
    return withRetries(this.retryPolicy, 'VAT schema check', async () => {
      const response = await this.sendRequest('POST', `${this.baseUrl}/vat/validate/schema`, body);

      return this.parseJsonResponse(response);
    });
  }

  async state(vatUid: string): Promise<VatResource> {
    return withRetries(this.retryPolicy, 'VAT state lookup', async () => {
      const response = await this.sendRequest('GET', `${this.baseUrl}/vat/state/${encodeURIComponent(vatUid)}`);
      const data = await this.parseJsonResponse(response);

      return VatResource.fromArray(data);
    });
  }

  async history(vatUid?: string): Promise<VatCollection> {
    let url = `${this.baseUrl}/vat/history`;
    if (vatUid) url += `?vat_uid=${encodeURIComponent(vatUid)}`;

    return withRetries(this.retryPolicy, 'VAT history request', async () => {
      const response = await this.sendRequest('GET', url);
      const data = await this.parseJsonResponse(response);

      return VatCollection.fromResponse(data);
    });
  }

  async search(term?: string, perPage?: number): Promise<VatCollection> {
    const params = new URLSearchParams();
    if (term) params.set('term', term);
    if (perPage !== undefined) params.set('per_page', String(perPage));

    const queryString = params.toString();
    const url = `${this.baseUrl}/vat/search${queryString ? `?${queryString}` : ''}`;

    return withRetries(this.retryPolicy, 'VAT search', async () => {
      const response = await this.sendRequest('GET', url);
      const data = await this.parseJsonResponse(response);

      return VatCollection.fromResponse(data);
    });
  }

  async certificate(uuid: string, lang?: Language): Promise<Uint8Array> {
    let url = `${this.baseUrl}/vat/certificate/${encodeURIComponent(uuid)}`;
    if (lang) url += `?lang=${lang}`;

    return withRetries(this.retryPolicy, 'VAT certificate download', async () => {
      const response = await this.sendBinaryRequest('GET', url);
      const buffer = await response.arrayBuffer();

      return new Uint8Array(buffer);
    });
  }

  async certificatesBulkExport(
    fromDate: Date | string,
    toDate: Date | string,
    countries?: string[],
    lang?: Language,
  ): Promise<VatCertificateExport> {
    return this.exportRequest(`${this.baseUrl}/vat/certificates/bulk-export`, fromDate, toDate, countries, lang);
  }

  async certificatesListExport(
    fromDate: Date | string,
    toDate: Date | string,
    countries?: string[],
    lang?: Language,
  ): Promise<VatCertificateExport> {
    return this.exportRequest(`${this.baseUrl}/vat/certificates/list-export`, fromDate, toDate, countries, lang);
  }

  private async exportRequest(
    url: string,
    fromDate: Date | string,
    toDate: Date | string,
    countries?: string[],
    lang?: Language,
  ): Promise<VatCertificateExport> {
    const from = this.formatDate(fromDate);
    const to = this.formatDate(toDate);

    const body: Record<string, unknown> = { from_date: from, to_date: to };
    if (countries && countries.length > 0) body['countries'] = countries;
    if (lang) body['lang'] = lang;

    const response = await this.sendRequest('POST', url, body);
    const data = await this.parseJsonResponse(response, [200, 202]);

    const exportObj = VatCertificateExport.fromArray(data);
    if (!exportObj.exportId) {
      throw new TaxoraException('Export response is missing export_id');
    }

    return exportObj;
  }

  async downloadBulkExport(exportId: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/vat/certificates/bulk-export/${encodeURIComponent(exportId)}/download`;

    return withRetries(this.retryPolicy, 'VAT export download', async () => {
      const response = await this.sendBinaryRequest('GET', url);
      const buffer = await response.arrayBuffer();

      return new Uint8Array(buffer);
    });
  }

  /**
   * Local tax numbers report as raw CSV (UTF-8 with BOM, comma-separated): every company checked —
   * single and bulk VAT checks and Smart Enrichment lookups — once, with its local tax number
   * (taxNumber, taxNumberName, taxNumberSource). Digit-only taxNumber cells carry a leading TAB so
   * Excel keeps them as text; `localTaxNumbers()` strips it for you.
   */
  async localTaxNumbersCsv(options: LocalTaxNumberReportOptions = {}): Promise<string> {
    const params = this.localTaxNumbersParams(options);
    if (options.onlyWithTaxNumber !== undefined) {
      params.set('only_with_tax_number', options.onlyWithTaxNumber ? '1' : '0');
    }
    const url = this.withQuery(`${this.baseUrl}/reports/local-tax-numbers`, params);

    return withRetries(this.retryPolicy, 'Local tax numbers report', async () => {
      const headers = this.buildHeaders();
      delete headers['Content-Type'];
      headers['Accept'] = 'text/csv, application/json';
      const response = await this.httpClient.request('GET', url, { headers });
      if (response.status === 422) {
        // Same error mapping as the JSON calls (ValidationException with field errors).
        await this.parseJsonResponse(response);
      }
      // Not response.text(): it drops the BOM, which Excel needs to read the file as UTF-8.
      const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
      if (!response.ok) {
        throw new HttpException(
          describeApiError(text, response.status),
          response.status,
          text,
          {},
          response.headers.get('retry-after'),
        );
      }
      return text;
    });
  }

  /** The local tax numbers report, parsed: one row per company (same filters as `localTaxNumbersCsv()`). */
  async localTaxNumbers(options: LocalTaxNumberReportOptions = {}): Promise<LocalTaxNumberRow[]> {
    return parseLocalTaxNumbersCsv(await this.localTaxNumbersCsv(options));
  }

  /** How many companies the report would list for the filters, and how many have a tax number. */
  async localTaxNumbersSummary(
    options: Omit<LocalTaxNumberReportOptions, 'onlyWithTaxNumber'> = {},
  ): Promise<LocalTaxNumberSummary> {
    const url = this.withQuery(
      `${this.baseUrl}/reports/local-tax-numbers/summary`,
      this.localTaxNumbersParams(options),
    );

    return withRetries(this.retryPolicy, 'Local tax numbers summary', async () => {
      const response = await this.sendRequest('GET', url);
      const data = await this.parseJsonResponse(response);
      const count = (key: string): number => (typeof data[key] === 'number' ? (data[key] as number) : 0);

      return { companies: count('companies'), withTaxNumber: count('withTaxNumber') };
    });
  }

  private localTaxNumbersParams(options: LocalTaxNumberReportOptions): URLSearchParams {
    const params = new URLSearchParams();
    if (options.dateFrom !== undefined) params.set('date_from', this.formatDate(options.dateFrom));
    if (options.dateTo !== undefined) params.set('date_to', this.formatDate(options.dateTo));
    for (const country of options.countries ?? []) {
      params.append('countries[]', country.trim().toUpperCase());
    }
    return params;
  }

  private withQuery(url: string, params: URLSearchParams): string {
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
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

  private async sendRequest(method: string, url: string, body?: Record<string, unknown>): Promise<Response> {
    const options: RequestInit = { headers: this.buildHeaders() };
    if (body) options.body = JSON.stringify(body);

    return this.httpClient.request(method, url, options);
  }

  private async sendBinaryRequest(method: string, url: string): Promise<Response> {
    const headers = this.buildHeaders();
    delete headers['Content-Type'];

    const response = await this.httpClient.request(method, url, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new HttpException(
        describeApiError(text, response.status),
        response.status,
        text,
        {},
        response.headers.get('retry-after'),
      );
    }
    return response;
  }

  private async parseJsonResponse(
    response: Response,
    acceptedStatuses: number[] = [200],
  ): Promise<Record<string, unknown>> {
    const responseText = await response.text();

    if (response.status === 422) {
      let errors: Record<string, string[]> = {};
      try {
        const parsed = JSON.parse(responseText) as Record<string, unknown>;
        if (parsed['errors'] !== null && typeof parsed['errors'] === 'object' && !Array.isArray(parsed['errors'])) {
          errors = parsed['errors'] as Record<string, string[]>;
        }
      } catch {
        // ignore parse errors
      }
      throw new ValidationException(jsonErrorMessage(responseText) ?? 'Validation failed', errors);
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

  private formatDate(date: Date | string): string {
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    if (!DATE_REGEX.test(date)) {
      throw new TaxoraException(`Invalid date format: "${date}". Expected YYYY-MM-DD.`);
    }

    return date;
  }
}

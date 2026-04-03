import { VatResource } from '../dto/VatResource.js';
import { VatCollection } from '../dto/VatCollection.js';
import { VatCertificateExport } from '../dto/VatCertificateExport.js';
import { VatValidationAddressInput } from '../dto/VatValidationAddressInput.js';
import { Language } from '../enums/Language.js';
import { HttpException } from '../exceptions/HttpException.js';
import { ValidationException } from '../exceptions/ValidationException.js';
import { TaxoraException } from '../exceptions/TaxoraException.js';
import { HttpClientInterface } from '../http/HttpClientInterface.js';
import { TokenStorageInterface } from '../http/TokenStorageInterface.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class VatEndpoint {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly httpClient: HttpClientInterface,
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
      body['address_input'] =
        addressInput instanceof VatValidationAddressInput ? addressInput.toArray() : addressInput;
    }

    return this.validateWithGatewayRetry(body, 2);
  }

  private async validateWithGatewayRetry(
    body: Record<string, unknown>,
    attemptsLeft: number,
  ): Promise<VatResource> {
    const response = await this.sendRequest('POST', `${this.baseUrl}/vat/validate`, body);

    if (response.status === 504) {
      if (attemptsLeft <= 1) {
        const text = await response.text();
        throw new HttpException('VAT validation timed out after multiple attempts', 504, text);
      }
      return this.validateWithGatewayRetry(body, attemptsLeft - 1);
    }

    const data = await this.parseJsonResponse(response);
    return VatResource.fromArray(data);
  }

  async validateMultiple(
    vatUids: string[],
    companyNames?: string[],
    provider?: string,
  ): Promise<VatCollection> {
    const body: Record<string, unknown> = { vat_uids: vatUids };
    if (companyNames) body['company_names'] = companyNames;
    if (provider) body['source'] = provider;

    const response = await this.sendRequest('POST', `${this.baseUrl}/vat/validate/multiple`, body);
    const data = await this.parseJsonResponse(response);

    return VatCollection.fromResponse(data);
  }

  async validateSchema(vatUid: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { vat_uid: vatUid };
    const response = await this.sendRequest('POST', `${this.baseUrl}/vat/validate/schema`, body);
    return this.parseJsonResponse(response);
  }

  async state(vatUid: string): Promise<VatResource> {
    const response = await this.sendRequest('GET', `${this.baseUrl}/vat/state/${encodeURIComponent(vatUid)}`);
    const data = await this.parseJsonResponse(response);
    return VatResource.fromArray(data);
  }

  async history(vatUid?: string): Promise<VatCollection> {
    let url = `${this.baseUrl}/vat/history`;
    if (vatUid) url += `?vat_uid=${encodeURIComponent(vatUid)}`;

    const response = await this.sendRequest('GET', url);
    const data = await this.parseJsonResponse(response);
    return VatCollection.fromResponse(data);
  }

  async search(term?: string, perPage?: number): Promise<VatCollection> {
    const params = new URLSearchParams();
    if (term) params.set('term', term);
    if (perPage !== undefined) params.set('per_page', String(perPage));

    const queryString = params.toString();
    const url = `${this.baseUrl}/vat/search${queryString ? `?${queryString}` : ''}`;

    const response = await this.sendRequest('GET', url);
    const data = await this.parseJsonResponse(response);
    return VatCollection.fromResponse(data);
  }

  async certificate(uuid: string, lang?: Language): Promise<Uint8Array> {
    let url = `${this.baseUrl}/vat/certificate/${encodeURIComponent(uuid)}`;
    if (lang) url += `?lang=${lang}`;

    const response = await this.sendBinaryRequest('GET', url);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
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

    const response = await this.sendRequest('POST', url, body, [200, 202]);
    const data = await this.parseJsonResponse(response, [200, 202]);

    const exportObj = VatCertificateExport.fromArray(data);
    if (!exportObj.exportId) {
      throw new TaxoraException('Export response is missing export_id');
    }

    return exportObj;
  }

  async downloadBulkExport(exportId: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/vat/certificates/bulk-export/${encodeURIComponent(exportId)}/download`;
    const response = await this.sendBinaryRequest('GET', url);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
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

  private async sendRequest(
    method: string,
    url: string,
    body?: Record<string, unknown>,
    acceptedStatuses: number[] = [200],
  ): Promise<Response> {
    const options: RequestInit = { headers: this.buildHeaders() };
    if (body) options.body = JSON.stringify(body);

    const response = await this.httpClient.request(method, url, options);
    return response;
  }

  private async sendBinaryRequest(method: string, url: string): Promise<Response> {
    const headers = this.buildHeaders();
    delete headers['Content-Type'];

    const response = await this.httpClient.request(method, url, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new HttpException(`HTTP error ${response.status}`, response.status, text);
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
      throw new ValidationException('Validation failed', errors);
    }

    if (!response.ok && !acceptedStatuses.includes(response.status)) {
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
      throw new TaxoraException(
        `Invalid date format: "${date}". Expected YYYY-MM-DD.`,
      );
    }

    return date;
  }
}

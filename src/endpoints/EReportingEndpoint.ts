import { ComplianceEnrollment } from '../dto/ComplianceEnrollment.js';
import { ComplianceEnrollmentPage } from '../dto/ComplianceEnrollmentPage.js';
import { ComplianceTaxReport } from '../dto/ComplianceTaxReport.js';
import { ComplianceTaxReportPage } from '../dto/ComplianceTaxReportPage.js';
import { ComplianceTransaction } from '../dto/ComplianceTransaction.js';
import { ComplianceTransactionPage } from '../dto/ComplianceTransactionPage.js';
import { ImportResult } from '../dto/ImportResult.js';
import { PeppolLookupResult } from '../dto/PeppolLookupResult.js';
import { RegistryCompany } from '../dto/RegistryCompany.js';
import { RevenueStatistics } from '../dto/RevenueStatistics.js';
import { SireneLookupResult } from '../dto/SireneLookupResult.js';
import { VatRates } from '../dto/VatRates.js';
import { type ComplianceService } from '../enums/ComplianceService.js';
import { type ComplianceTaxReportState } from '../enums/ComplianceTaxReportState.js';
import { type ComplianceTransactionState } from '../enums/ComplianceTransactionState.js';
import { type ComplianceTransactionType } from '../enums/ComplianceTransactionType.js';
import { HttpException } from '../exceptions/HttpException.js';
import { describeApiError } from '../exceptions/apiErrorMessage.js';
import { TaxoraException } from '../exceptions/TaxoraException.js';
import { ValidationException } from '../exceptions/ValidationException.js';
import { type HttpClientInterface } from '../http/HttpClientInterface.js';
import { RetryPolicy } from '../http/RetryPolicy.js';
import { withResponseRetries } from '../http/withRetries.js';
import { type TokenStorageInterface } from '../http/TokenStorageInterface.js';
import { NorwegianOrgNumber } from '../support/NorwegianOrgNumber.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const NAF_CODE_REGEX = /^\d{2}$/;
const COUNTRY_REGEX = /^[A-Za-z]{2}$/;
const PEPPOL_SCHEME_REGEX = /^\d{4}$/;

/** Time-series bucket size accepted by the revenue statistics endpoint. */
export type EReportingInterval = 'day' | 'week' | 'month';

/** Enterprise size categories accepted by the DGFiP enrollment. */
export type ComplianceEnterpriseSize = 'micro' | 'pme' | 'eti' | 'ge';

/** Type of operations the enrolled company performs. */
export type ComplianceTypeOperation = 'services' | 'goods' | 'mixed';

/** Services accepted on the request side (the tolerant `unknown` is response-only). */
export type ComplianceRequestService = Exclude<ComplianceService, 'unknown'>;

/** Transaction types accepted on the request side (the tolerant `unknown` is response-only). */
export type ComplianceTransactionRequestType = Exclude<ComplianceTransactionType, 'unknown'>;

/** Transaction states accepted as filters (the tolerant `unknown` is response-only). */
export type ComplianceTransactionRequestState = Exclude<ComplianceTransactionState, 'unknown'>;

/** Tax report states accepted as filters (the tolerant `unknown` is response-only). */
export type ComplianceTaxReportRequestState = Exclude<ComplianceTaxReportState, 'unknown'>;

const INTERVALS: readonly EReportingInterval[] = ['day', 'week', 'month'];
const SERVICES: readonly ComplianceRequestService[] = ['e_reporting', 'e_invoicing'];
const ENTERPRISE_SIZES: readonly ComplianceEnterpriseSize[] = ['micro', 'pme', 'eti', 'ge'];
const TYPE_OPERATIONS: readonly ComplianceTypeOperation[] = ['services', 'goods', 'mixed'];
const TRANSACTION_TYPES: readonly ComplianceTransactionRequestType[] = [
  'b2c_outbound',
  'b2b_domestic_outbound',
  'b2b_domestic_inbound',
  'crossborder_outbound',
  'crossborder_inbound',
];

export interface RevenueStatisticsFilters {
  dateFrom?: Date | string;
  dateTo?: Date | string;
  /** Time-series bucket size. Defaults to "month" server-side. */
  interval?: EReportingInterval;
  transactionType?: ComplianceTransactionRequestType;
  state?: ComplianceTransactionRequestState;
}

/**
 * France (DGFiP e-reporting) enrollment — the original createEnrollment() input.
 * For Norway use {@link CreateNorwayEnrollmentInput} (or createNorwayEnrollment()).
 */
export interface CreateComplianceEnrollmentInput {
  /** Reporting country (2-char ISO 3166-1 alpha-2). Defaults server-side (FR). "NO" selects the Norway input. */
  country?: string;
  /** Service to book. Defaults server-side to the country's default service (FR: "e_reporting"). */
  service?: ComplianceRequestService;
  /** Compliance regime, e.g. "dgfip_flux10". Defaults server-side. */
  regime?: string;
  /** 14-digit SIRET. Required unless `siren` is set. */
  siret?: string;
  /** 9-digit SIREN. Required unless `siret` is set. */
  siren?: string;
  vatNumber?: string;
  companyName?: string;
  address?: string;
  city?: string;
  postalcode?: string;
  province?: string;
  /** Notification email for the provider account. */
  email: string;
  /** 2-digit NAF division, e.g. "47". */
  nafCode: string;
  enterpriseSize: ComplianceEnterpriseSize;
  typeOperation: ComplianceTypeOperation;
  /** First date transactions are reported for (Date or strict YYYY-MM-DD). */
  reportingStartDate: Date | string;
  /** When false, only the provider account is created — the DGFiP regime is NOT activated. Defaults to true server-side. */
  autoActivate?: boolean;
}

/**
 * Norway e-invoicing (EHF / Peppol BIS 3.0) enrollment: registers the company
 * as a Peppol participant so it can send (and optionally receive) e-invoices.
 * Prefill it from registryLookup('NO', …).
 */
export interface CreateNorwayEnrollmentInput {
  country: 'NO';
  /** Service to book. Defaults server-side to "e_invoicing" (the only service for NO). */
  service?: ComplianceRequestService;
  /** Compliance regime. Defaults server-side ("peppol_bis3"). */
  regime?: string;
  /**
   * 9-digit Norwegian organisation number (mod-11 check digit). Spaces, a "NO"
   * prefix and an "MVA" suffix are accepted and stripped before sending.
   */
  orgNumber: string;
  companyName: string;
  address: string;
  city: string;
  postalcode: string;
  /** Notification email for the provider account. */
  email: string;
  vatNumber?: string;
  province?: string;
  /** Registered in Merverdiavgiftsregisteret (adds "MVA" to invoices). Defaults to true server-side. */
  vatRegistered?: boolean;
  /** Registered in Foretaksregisteret (adds "Foretaksregisteret" to invoices). Defaults to false server-side. */
  enterpriseRegister?: boolean;
  /** Also register to RECEIVE e-invoices over Peppol. Defaults to false server-side. */
  reception?: boolean;
  /** Country of the legal entity when it differs from NO (2-char ISO 3166-1 alpha-2). */
  legalCountry?: string;
  /** Optional first date transactions are recorded for (Date or strict YYYY-MM-DD). */
  reportingStartDate?: Date | string;
  /** When false, only the provider account is created — the Peppol registration is NOT activated. Defaults to true server-side. */
  autoActivate?: boolean;
}

/** createNorwayEnrollment() input — the Norway input without the fixed `country`. */
export type NorwayEnrollmentInput = Omit<CreateNorwayEnrollmentInput, 'country'>;

export interface ComplianceInvoiceTaxInput {
  /** Tax designation, e.g. "TVA". */
  name: string;
  /** VAT percentage, e.g. 20 or 5.5. */
  percent: number;
  /** DGFiP tax category code (S/AA/AAA/K/G/AE/E/Z) — see getVatRates(). */
  category: string;
  /** VATEX exemption code; required when `category` is "E". */
  comment?: string;
}

export interface ComplianceInvoiceLineInput {
  description: string;
  quantity: number;
  price: number;
  /** UN/ECE unit code, e.g. 9 (each). */
  unit?: number;
  /** At least one tax per line. */
  taxes: ComplianceInvoiceTaxInput[];
}

/**
 * Buyer and document fields interpreted per country. For Norway (EHF / Peppol)
 * `counterpartyRegisterId` (the buyer's organisation number) and
 * `counterpartyName` are required unless `providerContactId` is set, the
 * transaction type must be "b2b_domestic_outbound", and a credit note needs
 * `amendedNumber`. The SDK does not know the enrollment's country — those rules
 * are enforced server-side (422).
 */
export interface ComplianceTransactionBuyerInput {
  /** Buyer's company register id (Norway: 9-digit organisation number; "NO…MVA" is accepted). Max 30 chars. */
  counterpartyRegisterId?: string;
  counterpartyAddress?: string;
  counterpartyCity?: string;
  counterpartyPostalcode?: string;
  /** Buyer's email address. */
  counterpartyEmail?: string;
  /** Buyer reference (Peppol BuyerReference); max 100 chars. Norway defaults it to the buyer's org number. */
  buyerReference?: string;
  /** Issue the document as a credit note. */
  isCreditNote?: boolean;
  /** Number of the invoice a credit note corrects (max 50 chars). */
  amendedNumber?: string;
  /** Date of the invoice a credit note corrects (Date or strict YYYY-MM-DD). */
  amendedDate?: Date | string;
  /** Free-text note printed on the invoice (max 1000 chars). */
  extraInfo?: string;
}

export interface CreateComplianceTransactionInput extends ComplianceTransactionBuyerInput {
  complianceEnrollmentId: number;
  transactionType: ComplianceTransactionRequestType;
  invoiceNumber: string;
  /** Invoice date (Date or strict YYYY-MM-DD). */
  invoiceDate: Date | string;
  subtotal: number;
  total: number;
  /** At least one invoice line, each with at least one tax. */
  invoiceLines: ComplianceInvoiceLineInput[];
  dueDate?: Date | string;
  /** 3-char ISO 4217 code. Defaults to EUR server-side. */
  currency?: string;
  taxAmount?: number;
  counterpartyName?: string;
  /** 2-char ISO 3166-1 alpha-2 code. */
  counterpartyCountry?: string;
  counterpartyVatNumber?: string;
  providerContactId?: string;
  /** Payment means code; required for cross-border outbound. */
  paymentMethod?: number;
  remittanceInformation?: string;
  paymentMethodText?: string;
  paymentTerms?: string;
  /** When false, the transaction is only recorded — submission is deferred. Defaults to true server-side. */
  submitNow?: boolean;
}

export interface UpdateComplianceTransactionInput extends ComplianceTransactionBuyerInput {
  transactionType?: ComplianceTransactionRequestType;
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  dueDate?: Date | string;
  /** 3-char ISO 4217 code. */
  currency?: string;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  counterpartyName?: string;
  /** 2-char ISO 3166-1 alpha-2 code. */
  counterpartyCountry?: string;
  counterpartyVatNumber?: string;
  providerContactId?: string;
  /** When set: at least one invoice line, each with at least one tax. */
  invoiceLines?: ComplianceInvoiceLineInput[];
  paymentMethod?: number;
  remittanceInformation?: string;
  paymentMethodText?: string;
  paymentTerms?: string;
}

export interface ComplianceTransactionFilters {
  /** Inclusive lower bound on the invoice date (Date or strict YYYY-MM-DD). */
  dateFrom?: Date | string;
  /** Inclusive upper bound on the invoice date (Date or strict YYYY-MM-DD). */
  dateTo?: Date | string;
  state?: ComplianceTransactionRequestState;
  transactionType?: ComplianceTransactionRequestType;
  /** Only transactions of this enrollment. */
  complianceEnrollmentId?: number;
  /** Only transactions of this country (2-char ISO 3166-1 alpha-2). */
  country?: string;
  page?: number;
  /** Page size (1-100, default 25 server-side). */
  perPage?: number;
}

export interface EReportingAccessRequestInput {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  message?: string;
  /** Locale for the confirmation mail, e.g. "de" or "en". */
  language?: string;
  /** The service being requested. Defaults server-side to "e_reporting". */
  service?: ComplianceRequestService;
  /** The countries the service is requested for (2-char ISO codes), e.g. ["NO"]. */
  countries?: string[];
}

/**
 * E-Reporting / Compliance endpoints (per-country services).
 *
 * - France — e-reporting (DGFiP Flux 10): sireneLookup() to prefill company
 *   data, createEnrollment() to provision the provider account, then
 *   createTransaction() / importTransactions() to record invoices and
 *   listTaxReports() to track their DGFiP lifecycle.
 * - Norway — e-invoicing (EHF / Peppol BIS 3.0): registryLookup('NO', …) to
 *   prefill company/buyer data, createNorwayEnrollment() to register as a Peppol
 *   participant, peppolLookup('NO', …) to check a buyer is reachable, then
 *   createTransaction() to send invoices and credit notes.
 *
 * Each country/service is unlocked (and billed) separately; enrolling for a
 * service the company does not have yields a 403 with code `service_not_active`.
 * All routes except requestEReportingAccess() require compliance access on the
 * account.
 */
export class EReportingEndpoint {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tokenStorage: TokenStorageInterface,
    private readonly httpClient: HttpClientInterface,
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
  ) {}

  // ---------------------------------------------------------------------
  // Enrollments
  // ---------------------------------------------------------------------

  /**
   * Create a compliance enrollment and provision the provider account. By
   * default the country regime is activated right away (France: DGFiP tax
   * report setting; Norway: Peppol registration); pass `autoActivate: false`
   * to only create the account.
   *
   * The input shape depends on `country`: omitted/"FR" takes the France input
   * (unchanged, backwards compatible), "NO" the Norway input — see also the
   * createNorwayEnrollment() shortcut.
   *
   * Errors: 403 (HttpException, body code `service_not_active`) when the company
   * lacks the requested service; on provider failure 502 (HttpException) — the
   * enrollment is then persisted in `error_account`/`error_activation` state so
   * provisioning can be retried.
   */
  async createEnrollment(
    input: CreateComplianceEnrollmentInput | CreateNorwayEnrollmentInput,
  ): Promise<ComplianceEnrollment> {
    if (this.isNorwayEnrollmentInput(input)) {
      return this.createEnrollmentFromBody(this.buildNorwayEnrollmentBody(input));
    }

    this.validateEnrollmentInput(input);

    const body: Record<string, unknown> = {
      email: input.email,
      naf_code: input.nafCode,
      enterprise_size: input.enterpriseSize,
      type_operation: input.typeOperation,
      reporting_start_date: this.formatDate(input.reportingStartDate),
    };
    if (input.country !== undefined) body['country'] = input.country;
    if (input.service !== undefined) body['service'] = input.service;
    if (input.regime !== undefined) body['regime'] = input.regime;
    if (input.siret !== undefined) body['siret'] = input.siret;
    if (input.siren !== undefined) body['siren'] = input.siren;
    if (input.vatNumber !== undefined) body['vat_number'] = input.vatNumber;
    if (input.companyName !== undefined) body['company_name'] = input.companyName;
    if (input.address !== undefined) body['address'] = input.address;
    if (input.city !== undefined) body['city'] = input.city;
    if (input.postalcode !== undefined) body['postalcode'] = input.postalcode;
    if (input.province !== undefined) body['province'] = input.province;
    if (input.autoActivate !== undefined) body['auto_activate'] = input.autoActivate;

    return this.createEnrollmentFromBody(body);
  }

  /**
   * Enroll the company for Norway e-invoicing (EHF / Peppol BIS 3.0) — shortcut
   * for createEnrollment({ country: 'NO', ... }). The organisation number is
   * checked (mod-11) and normalized to 9 digits before sending.
   */
  async createNorwayEnrollment(input: NorwayEnrollmentInput): Promise<ComplianceEnrollment> {
    return this.createEnrollment({ ...input, country: 'NO' });
  }

  /** Paginated list of the company's enrollments (newest first). `perPage` is capped at 100 server-side. */
  async listEnrollments(page = 1, perPage = 25): Promise<ComplianceEnrollmentPage> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/enrollments?${params.toString()}`);
    // Double envelope: { success, data: { data: [...], meta: {...} } } — parseJsonResponse
    // unwraps the outer `data`; fromResponse reads the inner rows + pagination meta.
    return ComplianceEnrollmentPage.fromResponse(await this.parseJsonResponse(response));
  }

  /** Get a single enrollment by id. */
  async getEnrollment(id: number): Promise<ComplianceEnrollment> {
    this.validateId(id, 'id');

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/enrollments/${id}`);
    const data = await this.parseJsonResponse(response);
    return ComplianceEnrollment.fromArray(data);
  }

  /**
   * Look up company data by SIRET, SIREN or French VAT number via the French
   * SIRENE registry — ideal for prefilling createEnrollment().
   *
   * Rate-limited to 3 requests/minute per user (protects the external French
   * government API); exceeding it yields a 429 (mapped to an HttpException).
   */
  async sireneLookup(q: string): Promise<SireneLookupResult> {
    if (q.trim() === '') {
      throw new TaxoraException('q must not be empty.');
    }

    const params = new URLSearchParams();
    params.set('q', q);

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/sirene-lookup?${params.toString()}`);
    const data = await this.parseJsonResponse(response);
    return SireneLookupResult.fromArray(data);
  }

  /**
   * Look up companies in a national company register — currently Norway
   * (Brønnøysund Enhetsregisteret). `q` is an organisation number, a "NO…MVA"
   * VAT number or a company name; an exact number match yields one result.
   * Ideal for prefilling createNorwayEnrollment() and the buyer fields of an
   * e-invoice. For France use sireneLookup().
   *
   * Errors: 404 (HttpException) when nothing is found, 422 (ValidationException)
   * on invalid input / unsupported country, 429 (HttpException) when the
   * per-user rate limit (30/min) is exceeded.
   */
  async registryLookup(country: string, q: string): Promise<RegistryCompany[]> {
    const normalizedCountry = this.normalizeLookupCountry(country);
    const query = q.trim();
    if (query === '') {
      throw new TaxoraException('q must not be empty.');
    }
    if (normalizedCountry === 'NO') {
      const digits = NorwegianOrgNumber.normalize(query);
      if (/^\d{9}$/.test(digits) && !NorwegianOrgNumber.isValid(digits)) {
        throw new TaxoraException(`Invalid Norwegian organisation number "${query}" (check digit).`);
      }
    }

    const params = new URLSearchParams();
    params.set('country', normalizedCountry);
    params.set('q', query);

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/registry-lookup?${params.toString()}`);
    const data = await this.parseJsonResponse(response);
    const results = Array.isArray(data['results']) ? (data['results'] as unknown[]) : [];

    return results
      .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row))
      .map((row) => RegistryCompany.fromArray(row));
  }

  /**
   * Check whether a participant (typically the buyer) can receive e-invoices
   * over Peppol. For Norway pass the organisation number (scheme defaults to
   * "0192"): `reachable === true` means the buyer is registered in ELMA and must
   * receive an EHF e-invoice. The directory resolves asynchronously —
   * `status === 'pending'` (`reachable === null`) means ask again in a few
   * seconds. Free of charge; definite answers are cached for 24h server-side.
   *
   * A Norwegian organisation number is checked (mod-11) and normalized before
   * sending. Errors: 422 (ValidationException) on invalid input, 502
   * (HttpException) on provider failure.
   */
  async peppolLookup(country: string, id: string, scheme?: string): Promise<PeppolLookupResult> {
    const normalizedCountry = this.normalizeLookupCountry(country);
    let participantId = id.trim();
    if (participantId === '') {
      throw new TaxoraException('id must not be empty.');
    }
    if (scheme !== undefined && !PEPPOL_SCHEME_REGEX.test(scheme)) {
      throw new TaxoraException('scheme must be a 4-digit Peppol identifier scheme, e.g. "0192".');
    }
    if (normalizedCountry === 'NO' && (scheme === undefined || scheme === NorwegianOrgNumber.PEPPOL_SCHEME)) {
      if (!NorwegianOrgNumber.isValid(participantId)) {
        throw new TaxoraException(`Invalid Norwegian organisation number "${participantId}".`);
      }
      participantId = NorwegianOrgNumber.normalize(participantId);
    }

    const params = new URLSearchParams();
    params.set('country', normalizedCountry);
    params.set('id', participantId);
    if (scheme !== undefined) params.set('scheme', scheme);

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/peppol-lookup?${params.toString()}`);
    const data = await this.parseJsonResponse(response);
    return PeppolLookupResult.fromArray(data);
  }

  // ---------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------

  /**
   * Record and (by default) submit a Flux 10 transaction. Pass `submitNow: false`
   * to only record it — submission can be triggered later via submitTransaction().
   *
   * Immediate per-invoice submission requires the e-invoicing feature on the
   * account; in pure e-reporting mode the transaction is only recorded and
   * reported via the aggregated daily ledgers.
   *
   * Creation is idempotent on the invoice's natural key (enrollment, type,
   * invoice number, invoice date, counterparty VAT): a re-sent create returns
   * the existing transaction with HTTP 200 instead of creating a duplicate.
   *
   * On provider failure the API responds 502 (mapped to an HttpException).
   */
  async createTransaction(input: CreateComplianceTransactionInput): Promise<ComplianceTransaction> {
    this.validateId(input.complianceEnrollmentId, 'complianceEnrollmentId');
    this.validateTransactionType(input.transactionType);
    this.validateInvoiceNumber(input.invoiceNumber);
    this.validateInvoiceLines(input.invoiceLines);
    this.validateOptionalCodes(input);
    this.validateBuyerFields(input);

    const body: Record<string, unknown> = {
      compliance_enrollment_id: input.complianceEnrollmentId,
      transaction_type: input.transactionType,
      invoice_number: input.invoiceNumber,
      invoice_date: this.formatDate(input.invoiceDate),
      subtotal: input.subtotal,
      total: input.total,
      invoice_lines_attributes: this.buildInvoiceLines(input.invoiceLines),
    };
    this.applyOptionalTransactionFields(body, input);
    if (input.submitNow !== undefined) body['submit_now'] = input.submitNow;

    const response = await this.sendRequest('POST', `${this.baseUrl}/compliance/transactions`, body);
    // 201 = created, 200 = idempotent replay of an already-recorded invoice.
    const data = await this.parseJsonResponse(response);
    return ComplianceTransaction.fromArray(data);
  }

  /** Paginated list of the company's transactions (newest invoice date first), filterable by date / state / type / enrollment / country. */
  async listTransactions(filters: ComplianceTransactionFilters = {}): Promise<ComplianceTransactionPage> {
    if (filters.complianceEnrollmentId !== undefined) {
      this.validateId(filters.complianceEnrollmentId, 'complianceEnrollmentId');
    }
    if (filters.country !== undefined && !COUNTRY_REGEX.test(filters.country)) {
      throw new TaxoraException('country must be a 2-character ISO 3166-1 alpha-2 code.');
    }

    const params = new URLSearchParams();
    if (filters.dateFrom !== undefined) params.set('date_from', this.formatDate(filters.dateFrom));
    if (filters.dateTo !== undefined) params.set('date_to', this.formatDate(filters.dateTo));
    if (filters.state !== undefined) params.set('state', filters.state);
    if (filters.transactionType !== undefined) params.set('transaction_type', filters.transactionType);
    if (filters.complianceEnrollmentId !== undefined) {
      params.set('compliance_enrollment_id', String(filters.complianceEnrollmentId));
    }
    if (filters.country !== undefined) params.set('country', filters.country.toUpperCase());
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.perPage !== undefined) params.set('per_page', String(filters.perPage));

    const queryString = params.toString();
    const url = `${this.baseUrl}/compliance/transactions${queryString ? `?${queryString}` : ''}`;

    const response = await this.sendRequest('GET', url);
    return ComplianceTransactionPage.fromResponse(await this.parseJsonResponse(response));
  }

  /** Get a single transaction by id (includes its tax report when one exists). */
  async getTransaction(id: number): Promise<ComplianceTransaction> {
    this.validateId(id, 'id');

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/transactions/${id}`);
    const data = await this.parseJsonResponse(response);
    return ComplianceTransaction.fromArray(data);
  }

  /** Update a still-pending transaction. Only the provided fields are sent; already-submitted transactions are rejected with 422. */
  async updateTransaction(id: number, input: UpdateComplianceTransactionInput): Promise<ComplianceTransaction> {
    this.validateId(id, 'id');
    if (input.transactionType !== undefined) this.validateTransactionType(input.transactionType);
    if (input.invoiceNumber !== undefined) this.validateInvoiceNumber(input.invoiceNumber);
    if (input.invoiceLines !== undefined) this.validateInvoiceLines(input.invoiceLines);
    this.validateOptionalCodes(input);
    this.validateBuyerFields(input);

    const body: Record<string, unknown> = {};
    if (input.transactionType !== undefined) body['transaction_type'] = input.transactionType;
    if (input.invoiceNumber !== undefined) body['invoice_number'] = input.invoiceNumber;
    if (input.invoiceDate !== undefined) body['invoice_date'] = this.formatDate(input.invoiceDate);
    if (input.subtotal !== undefined) body['subtotal'] = input.subtotal;
    if (input.total !== undefined) body['total'] = input.total;
    if (input.invoiceLines !== undefined) body['invoice_lines_attributes'] = this.buildInvoiceLines(input.invoiceLines);
    this.applyOptionalTransactionFields(body, input);

    const response = await this.sendRequest('PUT', `${this.baseUrl}/compliance/transactions/${id}`, body);
    const data = await this.parseJsonResponse(response);
    return ComplianceTransaction.fromArray(data);
  }

  /** Delete a still-pending transaction. Already-submitted transactions are rejected with 422. */
  async deleteTransaction(id: number): Promise<void> {
    this.validateId(id, 'id');

    const response = await this.sendRequest('DELETE', `${this.baseUrl}/compliance/transactions/${id}`);
    await this.assertNoContentResponse(response);
  }

  /**
   * Submit (or retry) an existing `pending`/`error` transaction to the provider.
   * Replays the invoice lines stored at creation, so they don't have to be re-sent.
   *
   * Requires the e-invoicing feature on the account — pure e-reporting customers
   * get a 422 (transactions are reported via the aggregated daily ledgers instead).
   *
   * On provider failure the API responds 502 (mapped to an HttpException);
   * already-submitted transactions are rejected with 422.
   */
  async submitTransaction(id: number): Promise<ComplianceTransaction> {
    this.validateId(id, 'id');

    const response = await this.sendRequest('POST', `${this.baseUrl}/compliance/transactions/${id}/submit`);
    const data = await this.parseJsonResponse(response);
    return ComplianceTransaction.fromArray(data);
  }

  /**
   * Bulk-import transactions from a semicolon-separated CSV (one row per invoice
   * line; rows sharing an invoice_number are grouped into one transaction).
   * Required columns: invoice_number, invoice_date, transaction_type, subtotal,
   * total, line_description, line_quantity, line_price, tax_name, tax_percent,
   * tax_category.
   *
   * The import is idempotent: re-uploading the same file skips rows whose
   * invoice already exists (reported via `skippedDuplicates`).
   */
  async importTransactions(
    enrollmentId: number,
    csvContent: string,
    filename = 'transactions.csv',
  ): Promise<ImportResult> {
    this.validateId(enrollmentId, 'enrollmentId');
    if (csvContent.trim() === '') {
      throw new TaxoraException('csvContent must not be empty.');
    }

    const form = new FormData();
    form.set('compliance_enrollment_id', String(enrollmentId));
    form.set('file', new Blob([csvContent], { type: 'text/csv' }), filename);

    const response = await this.sendMultipartRequest('POST', `${this.baseUrl}/compliance/transactions/import`, form);
    const data = await this.parseJsonResponse(response);
    return ImportResult.fromArray(data);
  }

  // ---------------------------------------------------------------------
  // Analytics, configuration & reports
  // ---------------------------------------------------------------------

  /**
   * Aggregated turnover statistics for the authenticated company's e-reporting
   * transactions. All arguments are optional — the API defaults to the last 12
   * months and a monthly interval.
   */
  async getRevenueStatistics(filters: RevenueStatisticsFilters = {}): Promise<RevenueStatistics> {
    if (filters.interval !== undefined && !INTERVALS.includes(filters.interval)) {
      throw new TaxoraException(
        `Invalid statistics interval "${String(filters.interval)}". Expected one of: ${INTERVALS.join(', ')}.`,
      );
    }

    const params = new URLSearchParams();
    if (filters.dateFrom !== undefined) params.set('date_from', this.formatDate(filters.dateFrom));
    if (filters.dateTo !== undefined) params.set('date_to', this.formatDate(filters.dateTo));
    if (filters.interval !== undefined) params.set('interval', filters.interval);
    if (filters.transactionType !== undefined) params.set('transaction_type', filters.transactionType);
    if (filters.state !== undefined) params.set('state', filters.state);

    const queryString = params.toString();
    const url = `${this.baseUrl}/compliance/revenue-statistics${queryString ? `?${queryString}` : ''}`;

    const response = await this.sendRequest('GET', url);
    const data = await this.parseJsonResponse(response);

    return RevenueStatistics.fromArray(data);
  }

  /**
   * The canonical VAT rates & DGFiP tax categories for a reporting country
   * (the seller's reporting-country rates, not the counterparty's). Falls back
   * to the configured default country (FR) when none/unknown is given.
   */
  async getVatRates(country?: string): Promise<VatRates> {
    const params = new URLSearchParams();
    if (country !== undefined) params.set('country', country);

    const queryString = params.toString();
    const url = `${this.baseUrl}/compliance/vat-rates${queryString ? `?${queryString}` : ''}`;

    const response = await this.sendRequest('GET', url);
    const data = await this.parseJsonResponse(response);
    return VatRates.fromArray(data);
  }

  /** Paginated list of the company's tax reports (newest first), optionally filtered by state. */
  async listTaxReports(
    page = 1,
    perPage = 25,
    state?: ComplianceTaxReportRequestState,
  ): Promise<ComplianceTaxReportPage> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (state !== undefined) params.set('state', state);

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/tax-reports?${params.toString()}`);
    return ComplianceTaxReportPage.fromResponse(await this.parseJsonResponse(response));
  }

  /** Get a single tax report by id. */
  async getTaxReport(id: number): Promise<ComplianceTaxReport> {
    this.validateId(id, 'id');

    const response = await this.sendRequest('GET', `${this.baseUrl}/compliance/tax-reports/${id}`);
    const data = await this.parseJsonResponse(response);
    return ComplianceTaxReport.fromArray(data);
  }

  /**
   * Request activation of the E-Reporting feature for the account. This route
   * is deliberately NOT gated by compliance access — it exists precisely for
   * accounts that do not have the feature yet. The authenticated user's
   * name/email take precedence over the form values server-side.
   *
   * Note: unlike the other compliance routes, validation failures here are
   * returned as HTTP 400 (surfaced as HttpException), not 422.
   */
  async requestEReportingAccess(input: EReportingAccessRequestInput = {}): Promise<void> {
    if (input.service !== undefined) this.validateService(input.service);
    if (input.countries !== undefined) {
      input.countries.forEach((country, index) => {
        if (!COUNTRY_REGEX.test(country)) {
          throw new TaxoraException(`countries[${index}] must be a 2-character ISO 3166-1 alpha-2 code.`);
        }
      });
    }

    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body['name'] = input.name;
    if (input.email !== undefined) body['email'] = input.email;
    if (input.company !== undefined) body['company'] = input.company;
    if (input.phone !== undefined) body['phone'] = input.phone;
    if (input.message !== undefined) body['message'] = input.message;
    if (input.language !== undefined) body['language'] = input.language;
    if (input.service !== undefined) body['service'] = input.service;
    if (input.countries !== undefined) body['countries'] = input.countries.map((c) => c.toUpperCase());

    const response = await this.sendRequest('POST', `${this.baseUrl}/compliance/e-reporting-request`, body);
    await this.parseJsonResponse(response);
  }

  // ---------------------------------------------------------------------
  // Input validation (fail fast, before any request is sent)
  // ---------------------------------------------------------------------

  private validateEnrollmentInput(input: CreateComplianceEnrollmentInput): void {
    if (input.siret === undefined && input.siren === undefined) {
      throw new TaxoraException('Either siret or siren is required.');
    }
    if (input.siret !== undefined && input.siret.length !== 14) {
      throw new TaxoraException('siret must be exactly 14 characters.');
    }
    if (input.siren !== undefined && input.siren.length !== 9) {
      throw new TaxoraException('siren must be exactly 9 characters.');
    }
    if (input.email.trim() === '' || !input.email.includes('@')) {
      throw new TaxoraException('email must be a valid email address.');
    }
    if (!NAF_CODE_REGEX.test(input.nafCode)) {
      throw new TaxoraException('nafCode must be exactly 2 digits, e.g. "47".');
    }
    if (!ENTERPRISE_SIZES.includes(input.enterpriseSize)) {
      throw new TaxoraException(
        `Invalid enterpriseSize "${String(input.enterpriseSize)}". Expected one of: ${ENTERPRISE_SIZES.join(', ')}.`,
      );
    }
    if (!TYPE_OPERATIONS.includes(input.typeOperation)) {
      throw new TaxoraException(
        `Invalid typeOperation "${String(input.typeOperation)}". Expected one of: ${TYPE_OPERATIONS.join(', ')}.`,
      );
    }
    if (input.country !== undefined && input.country.length !== 2) {
      throw new TaxoraException('country must be a 2-character ISO 3166-1 alpha-2 code.');
    }
    if (input.service !== undefined) this.validateService(input.service);
  }

  private isNorwayEnrollmentInput(
    input: CreateComplianceEnrollmentInput | CreateNorwayEnrollmentInput,
  ): input is CreateNorwayEnrollmentInput {
    return typeof input.country === 'string' && input.country.trim().toUpperCase() === 'NO';
  }

  /** Validates the Norway input and builds its wire body (org number normalized to 9 digits). */
  private buildNorwayEnrollmentBody(input: CreateNorwayEnrollmentInput): Record<string, unknown> {
    if (typeof input.orgNumber !== 'string' || !NorwegianOrgNumber.isValid(input.orgNumber)) {
      throw new TaxoraException(
        'orgNumber must be a valid 9-digit Norwegian organisation number (mod-11 check digit).',
      );
    }
    for (const field of ['companyName', 'address', 'city', 'postalcode'] as const) {
      if (typeof input[field] !== 'string' || input[field].trim() === '') {
        throw new TaxoraException(`${field} is required for a Norway enrollment.`);
      }
    }
    this.validateEmail(input.email, 'email');
    if (input.service !== undefined) this.validateService(input.service);
    if (input.legalCountry !== undefined && !COUNTRY_REGEX.test(input.legalCountry)) {
      throw new TaxoraException('legalCountry must be a 2-character ISO 3166-1 alpha-2 code.');
    }

    const body: Record<string, unknown> = {
      country: 'NO',
      org_number: NorwegianOrgNumber.normalize(input.orgNumber),
      company_name: input.companyName,
      address: input.address,
      city: input.city,
      postalcode: input.postalcode,
      email: input.email,
    };
    if (input.service !== undefined) body['service'] = input.service;
    if (input.regime !== undefined) body['regime'] = input.regime;
    if (input.vatNumber !== undefined) body['vat_number'] = input.vatNumber;
    if (input.province !== undefined) body['province'] = input.province;
    if (input.vatRegistered !== undefined) body['vat_registered'] = input.vatRegistered;
    if (input.enterpriseRegister !== undefined) body['enterprise_register'] = input.enterpriseRegister;
    if (input.reception !== undefined) body['reception'] = input.reception;
    if (input.legalCountry !== undefined) body['legal_country'] = input.legalCountry.toUpperCase();
    if (input.reportingStartDate !== undefined) {
      body['reporting_start_date'] = this.formatDate(input.reportingStartDate);
    }
    if (input.autoActivate !== undefined) body['auto_activate'] = input.autoActivate;

    return body;
  }

  private async createEnrollmentFromBody(body: Record<string, unknown>): Promise<ComplianceEnrollment> {
    const response = await this.sendRequest('POST', `${this.baseUrl}/compliance/enrollments`, body);
    const data = await this.parseJsonResponse(response);
    return ComplianceEnrollment.fromArray(data);
  }

  private validateService(service: ComplianceRequestService): void {
    if (!SERVICES.includes(service)) {
      throw new TaxoraException(`Invalid service "${String(service)}". Expected one of: ${SERVICES.join(', ')}.`);
    }
  }

  private validateEmail(email: string | undefined, name: string): void {
    if (typeof email !== 'string' || email.trim() === '' || !email.includes('@')) {
      throw new TaxoraException(`${name} must be a valid email address.`);
    }
  }

  /** Lookup routes take a 2-letter country; the API expects it upper-case. */
  private normalizeLookupCountry(country: string): string {
    const normalized = country.trim().toUpperCase();
    if (!COUNTRY_REGEX.test(normalized)) {
      throw new TaxoraException('country must be a 2-character ISO 3166-1 alpha-2 code.');
    }
    return normalized;
  }

  private validateId(id: number, name: string): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new TaxoraException(`${name} must be a positive integer.`);
    }
  }

  private validateTransactionType(type: ComplianceTransactionRequestType): void {
    if (!TRANSACTION_TYPES.includes(type)) {
      throw new TaxoraException(
        `Invalid transactionType "${String(type)}". Expected one of: ${TRANSACTION_TYPES.join(', ')}.`,
      );
    }
  }

  private validateInvoiceNumber(invoiceNumber: string): void {
    if (invoiceNumber.trim() === '') {
      throw new TaxoraException('invoiceNumber must not be empty.');
    }
    if (invoiceNumber.length > 50) {
      throw new TaxoraException('invoiceNumber must not exceed 50 characters.');
    }
  }

  private validateInvoiceLines(lines: ComplianceInvoiceLineInput[]): void {
    if (lines.length === 0) {
      throw new TaxoraException('invoiceLines must contain at least one line.');
    }
    lines.forEach((line, index) => {
      if (line.taxes.length === 0) {
        throw new TaxoraException(`invoiceLines[${index}].taxes must contain at least one tax.`);
      }
    });
  }

  private validateOptionalCodes(input: { currency?: string; counterpartyCountry?: string }): void {
    if (input.currency !== undefined && input.currency.length !== 3) {
      throw new TaxoraException('currency must be a 3-character ISO 4217 code.');
    }
    if (input.counterpartyCountry !== undefined && input.counterpartyCountry.length !== 2) {
      throw new TaxoraException('counterpartyCountry must be a 2-character ISO 3166-1 alpha-2 code.');
    }
  }

  /**
   * Format checks for the buyer/document fields. Country rules (e.g. the Norway
   * org number being required) depend on the enrollment and stay server-side;
   * a register id is only check-digit validated when the buyer is Norwegian.
   */
  private validateBuyerFields(input: ComplianceTransactionBuyerInput & { counterpartyCountry?: string }): void {
    if (input.counterpartyRegisterId !== undefined) {
      if (input.counterpartyRegisterId.length > 30) {
        throw new TaxoraException('counterpartyRegisterId must not exceed 30 characters.');
      }
      if (
        input.counterpartyCountry?.toUpperCase() === 'NO' &&
        !NorwegianOrgNumber.isValid(input.counterpartyRegisterId)
      ) {
        throw new TaxoraException(
          'counterpartyRegisterId must be a valid 9-digit Norwegian organisation number (mod-11 check digit).',
        );
      }
    }
    if (input.counterpartyEmail !== undefined) this.validateEmail(input.counterpartyEmail, 'counterpartyEmail');
    if (input.buyerReference !== undefined && input.buyerReference.length > 100) {
      throw new TaxoraException('buyerReference must not exceed 100 characters.');
    }
    if (input.amendedNumber !== undefined && input.amendedNumber.length > 50) {
      throw new TaxoraException('amendedNumber must not exceed 50 characters.');
    }
    if (input.extraInfo !== undefined && input.extraInfo.length > 1000) {
      throw new TaxoraException('extraInfo must not exceed 1000 characters.');
    }
  }

  // ---------------------------------------------------------------------
  // Body building (camelCase input → snake_case wire format)
  // ---------------------------------------------------------------------

  private buildInvoiceLines(lines: ComplianceInvoiceLineInput[]): Record<string, unknown>[] {
    return lines.map((line) => {
      const built: Record<string, unknown> = {
        description: line.description,
        quantity: line.quantity,
        price: line.price,
        taxes_attributes: line.taxes.map((tax) => {
          const taxBuilt: Record<string, unknown> = {
            name: tax.name,
            percent: tax.percent,
            category: tax.category,
          };
          if (tax.comment !== undefined) taxBuilt['comment'] = tax.comment;
          return taxBuilt;
        }),
      };
      if (line.unit !== undefined) built['unit'] = line.unit;
      return built;
    });
  }

  /** Applies the optional scalar fields shared by create and update. */
  private applyOptionalTransactionFields(
    body: Record<string, unknown>,
    input: CreateComplianceTransactionInput | UpdateComplianceTransactionInput,
  ): void {
    if (input.dueDate !== undefined) body['due_date'] = this.formatDate(input.dueDate);
    if (input.currency !== undefined) body['currency'] = input.currency;
    if (input.taxAmount !== undefined) body['tax_amount'] = input.taxAmount;
    if (input.counterpartyName !== undefined) body['counterparty_name'] = input.counterpartyName;
    if (input.counterpartyCountry !== undefined) body['counterparty_country'] = input.counterpartyCountry;
    if (input.counterpartyVatNumber !== undefined) body['counterparty_vat_number'] = input.counterpartyVatNumber;
    if (input.providerContactId !== undefined) body['provider_contact_id'] = input.providerContactId;
    if (input.paymentMethod !== undefined) body['payment_method'] = input.paymentMethod;
    if (input.remittanceInformation !== undefined) body['remittance_information'] = input.remittanceInformation;
    if (input.paymentMethodText !== undefined) body['payment_method_text'] = input.paymentMethodText;
    if (input.paymentTerms !== undefined) body['payment_terms'] = input.paymentTerms;
    if (input.counterpartyRegisterId !== undefined) body['counterparty_register_id'] = input.counterpartyRegisterId;
    if (input.counterpartyAddress !== undefined) body['counterparty_address'] = input.counterpartyAddress;
    if (input.counterpartyCity !== undefined) body['counterparty_city'] = input.counterpartyCity;
    if (input.counterpartyPostalcode !== undefined) body['counterparty_postalcode'] = input.counterpartyPostalcode;
    if (input.counterpartyEmail !== undefined) body['counterparty_email'] = input.counterpartyEmail;
    if (input.buyerReference !== undefined) body['buyer_reference'] = input.buyerReference;
    if (input.isCreditNote !== undefined) body['is_credit_note'] = input.isCreditNote;
    if (input.amendedNumber !== undefined) body['amended_number'] = input.amendedNumber;
    if (input.amendedDate !== undefined) body['amended_date'] = this.formatDate(input.amendedDate);
    if (input.extraInfo !== undefined) body['extra_info'] = input.extraInfo;
  }

  // ---------------------------------------------------------------------
  // HTTP plumbing (kept in sync with SmartEnrichmentEndpoint)
  // ---------------------------------------------------------------------

  private buildHeaders(withJsonContentType = true): Record<string, string> {
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
    };
    if (withJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
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
    return method === 'GET' ? withResponseRetries(this.retryPolicy, 'e-reporting request', send) : send();
  }

  /** Multipart upload: Content-Type is left to fetch so the boundary is set correctly. */
  private async sendMultipartRequest(method: string, url: string, form: FormData): Promise<Response> {
    return this.httpClient.request(method, url, { headers: this.buildHeaders(false), body: form });
  }

  /** Accepts any 2xx response (e.g. 201 on create, 200 on idempotent replay). */
  private async parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
    const responseText = await response.text();

    if (response.status === 422) {
      throw this.buildValidationException(responseText);
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

    const obj = parsed as Record<string, unknown>;
    if (obj['data'] !== undefined && typeof obj['data'] === 'object' && obj['data'] !== null) {
      return obj['data'] as Record<string, unknown>;
    }

    return obj;
  }

  /** For the 204 delete: keeps the shared 422/HTTP error mapping but never parses a body. */
  private async assertNoContentResponse(response: Response): Promise<void> {
    if (response.status === 204) {
      return;
    }

    const responseText = await response.text();

    if (response.status === 422) {
      throw this.buildValidationException(responseText);
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
  }

  /**
   * The backend emits two 422 shapes: Laravel FormRequest failures as
   * `{message, errors: {field: [...]}}` and state-guard errors via returnError()
   * as `{error: "reason"}`. Preserve the reason in both cases.
   */
  private buildValidationException(responseText: string): ValidationException {
    let message = 'Validation failed';
    let errors: Record<string, string[]> = {};

    try {
      const parsed = JSON.parse(responseText) as Record<string, unknown>;
      if (parsed['errors'] !== null && typeof parsed['errors'] === 'object' && !Array.isArray(parsed['errors'])) {
        errors = parsed['errors'] as Record<string, string[]>;
      }
      if (typeof parsed['message'] === 'string' && parsed['message'] !== '') {
        message = parsed['message'];
      } else if (typeof parsed['error'] === 'string' && parsed['error'] !== '') {
        message = parsed['error'];
      }
    } catch {
      // ignore parse errors
    }

    return new ValidationException(message, errors, { responseBody: responseText });
  }

  /**
   * Date objects are serialized from their LOCAL date parts — construct them as
   * `new Date('2026-09-01T00:00:00')` (local midnight); a bare `new Date('2026-09-01')`
   * is UTC midnight and shifts a day back in UTC-negative timezones.
   */
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

import { describe, it, expect } from 'vitest';
import {
  EReportingEndpoint,
  type ComplianceTransactionRequestType,
  type ComplianceEnterpriseSize,
  type CreateComplianceEnrollmentInput,
  type CreateComplianceTransactionInput,
  type EReportingInterval,
} from '../../src/endpoints/EReportingEndpoint.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { ComplianceEnrollment } from '../../src/dto/ComplianceEnrollment.js';
import { ComplianceEnrollmentPage } from '../../src/dto/ComplianceEnrollmentPage.js';
import { ComplianceTaxReport } from '../../src/dto/ComplianceTaxReport.js';
import { ComplianceTaxReportPage } from '../../src/dto/ComplianceTaxReportPage.js';
import { ComplianceTransaction } from '../../src/dto/ComplianceTransaction.js';
import { ComplianceTransactionPage } from '../../src/dto/ComplianceTransactionPage.js';
import { ImportResult } from '../../src/dto/ImportResult.js';
import { RevenueStatistics } from '../../src/dto/RevenueStatistics.js';
import { SireneLookupResult } from '../../src/dto/SireneLookupResult.js';
import { VatRates } from '../../src/dto/VatRates.js';
import { ComplianceEnrollmentStatus } from '../../src/enums/ComplianceEnrollmentStatus.js';
import { ComplianceTaxReportState } from '../../src/enums/ComplianceTaxReportState.js';
import { ComplianceTransactionState } from '../../src/enums/ComplianceTransactionState.js';
import { ComplianceTransactionType } from '../../src/enums/ComplianceTransactionType.js';
import { HttpException } from '../../src/exceptions/HttpException.js';
import { TaxoraException } from '../../src/exceptions/TaxoraException.js';
import { ValidationException } from '../../src/exceptions/ValidationException.js';

const BASE_URL = 'https://sandbox.taxora.io/v1';
const API_KEY = 'test-api-key';

const STATS_PAYLOAD = {
  success: true,
  data: {
    range: { date_from: '2026-01-01', date_to: '2026-06-30', interval: 'month' },
    primary_currency: 'EUR',
    is_multi_currency: false,
    totals: { count: 3, subtotal: '350.0000', tax_amount: '60.0000', total: '410.0000' },
    time_series: [
      { bucket: '2026-01', count: 2, subtotal: '300.0000', tax_amount: '60.0000', total: '360.0000' },
      { bucket: '2026-02', count: 1, subtotal: '50.0000', tax_amount: '0.0000', total: '50.0000' },
    ],
    by_type: [{ type: 'b2c_outbound', type_label: 'B2C outbound', count: 2, total: '360.0000' }],
    by_country: [{ country: 'de', count: 2, total: '360.0000' }],
    by_state: [{ state: 'submitted', state_label: 'Submitted', count: 2, total: '360.0000' }],
    by_currency: [{ currency: 'EUR', count: 3, subtotal: '350.0000', tax_amount: '60.0000', total: '410.0000' }],
  },
};

const ENROLLMENT_PAYLOAD = {
  id: 12,
  company_id: 42,
  country: 'fr',
  regime: 'dgfip_flux10',
  provider: 'b2brouter',
  status: 'regime_activated',
  status_label: 'Regime activated',
  status_error: null,
  provider_account_id: '83428',
  tax_id: 'FR32123456789',
  company_register_id: '12345678900012',
  company_register_scheme: '0009',
  regime_config: { naf_code: '47', enterprise_size: 'pme', type_operation: 'mixed' },
  reporting_start_date: '2026-09-01',
  notification_email: 'tax@acme.fr',
  auto_send: true,
  created_at: '2026-07-01T10:00:00+00:00',
  updated_at: '2026-07-01T10:00:05+00:00',
};

const TAX_REPORT_PAYLOAD = {
  id: 7,
  company_id: 42,
  compliance_transaction_id: 99,
  ledger_id: 3,
  country: 'fr',
  regime: 'dgfip_flux10',
  state: 'registered',
  state_label: 'Registered',
  is_terminal: true,
  provider_tax_report_id: 'tr-555',
  provider_ledger_id: 'lg-777',
  base_amount: '100.00',
  tax_amount: '20.00',
  total_amount: '120.00',
  refusal_reason: null,
  registered_at: '2026-07-03T04:00:00+00:00',
  refused_at: null,
  created_at: '2026-07-02T10:00:00+00:00',
  updated_at: '2026-07-03T04:00:00+00:00',
};

const TRANSACTION_PAYLOAD = {
  id: 99,
  company_id: 42,
  compliance_enrollment_id: 12,
  country: 'fr',
  regime: 'dgfip_flux10',
  transaction_type: 'b2c_outbound',
  transaction_type_label: 'B2C outbound',
  state: 'submitted',
  state_label: 'Submitted',
  invoice_number: 'TKT-2026-00001',
  invoice_date: '2026-07-01',
  due_date: null,
  currency: 'EUR',
  subtotal: '100.00',
  tax_amount: '20.00',
  total: '120.00',
  counterparty_name: null,
  counterparty_country: 'de',
  counterparty_vat_number: null,
  is_paid: false,
  paid_at: null,
  provider_invoice_id: 'inv-123',
  submission_error: null,
  reported_at: '2026-07-02T00:00:00+00:00',
  tax_report: TAX_REPORT_PAYLOAD,
  created_at: '2026-07-01T10:00:00+00:00',
  updated_at: '2026-07-02T00:00:00+00:00',
};

function envelope(data: unknown, status = 200): Response {
  return SequenceHttpClient.jsonResponse({ success: true, data }, status);
}

function pageEnvelope(rows: unknown[], meta: Record<string, unknown>, status = 200): Response {
  return envelope({ data: rows, meta }, status);
}

function validEnrollmentInput(): CreateComplianceEnrollmentInput {
  return {
    siret: '12345678900012',
    email: 'tax@acme.fr',
    nafCode: '47',
    enterpriseSize: 'pme',
    typeOperation: 'mixed',
    reportingStartDate: '2026-09-01',
  };
}

function validTransactionInput(): CreateComplianceTransactionInput {
  return {
    complianceEnrollmentId: 12,
    transactionType: 'b2c_outbound',
    invoiceNumber: 'TKT-2026-00001',
    invoiceDate: '2026-07-01',
    subtotal: 100,
    total: 120,
    invoiceLines: [
      {
        description: 'Ticket',
        quantity: 1,
        price: 100,
        taxes: [{ name: 'TVA', percent: 20, category: 'S' }],
      },
    ],
  };
}

function makeEndpoint(responses: Response[]) {
  const storage = new InMemoryTokenStorage();
  storage.set(new Token('test-token', 'Bearer', new Date(Date.now() + 3600_000)));
  const client = new SequenceHttpClient(responses);
  const endpoint = new EReportingEndpoint(BASE_URL, API_KEY, storage, client);
  return { endpoint, client };
}

describe('EReportingEndpoint.getRevenueStatistics', () => {
  it('sends GET to /compliance/revenue-statistics with query params and returns a RevenueStatistics', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(STATS_PAYLOAD)]);

    const result = await endpoint.getRevenueStatistics({
      dateFrom: new Date('2026-01-01T00:00:00'),
      dateTo: '2026-06-30',
      interval: 'month',
      transactionType: 'b2c_outbound',
      state: 'submitted',
    });

    const req = client.requests[0]!;
    expect(req.method).toBe('GET');

    const url = new URL(req.url);
    expect(url.pathname).toBe('/v1/compliance/revenue-statistics');
    expect(url.searchParams.get('date_from')).toBe('2026-01-01');
    expect(url.searchParams.get('date_to')).toBe('2026-06-30');
    expect(url.searchParams.get('interval')).toBe('month');
    expect(url.searchParams.get('transaction_type')).toBe('b2c_outbound');
    expect(url.searchParams.get('state')).toBe('submitted');

    expect(result).toBeInstanceOf(RevenueStatistics);
    expect(result.primaryCurrency).toBe('EUR');
    expect(result.isMultiCurrency).toBe(false);
    expect(result.dateFrom).toBe('2026-01-01');
    expect(result.interval).toBe('month');

    expect(result.totals.count).toBe(3);
    expect(result.totals.total).toBe('410.0000');

    expect(result.timeSeries).toHaveLength(2);
    expect(result.timeSeries[0]!.bucket).toBe('2026-01');
    expect(result.timeSeries[0]!.total).toBe('360.0000');

    expect(result.byType[0]!.type).toBe('b2c_outbound');
    expect(result.byType[0]!.typeLabel).toBe('B2C outbound');
    expect(result.byCountry[0]!.country).toBe('de');
    expect(result.byState[0]!.state).toBe('submitted');
    expect(result.byCurrency[0]!.currency).toBe('EUR');
  });

  it('omits unset query parameters', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(STATS_PAYLOAD)]);

    await endpoint.getRevenueStatistics();

    const url = new URL(client.requests[0]!.url);
    expect(url.search).toBe('');
  });

  it('throws ValidationException on a 422 response', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Validation failed', errors: { interval: ['invalid'] } }, 422),
    ]);

    await expect(endpoint.getRevenueStatistics({ interval: 'month' })).rejects.toBeInstanceOf(ValidationException);
  });

  it('throws TaxoraException without a request on an invalid interval', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.getRevenueStatistics({ interval: 'year' as EReportingInterval })).rejects.toThrow(
      TaxoraException,
    );
    await expect(endpoint.getRevenueStatistics({ interval: 'year' as EReportingInterval })).rejects.toThrow(
      'Invalid statistics interval "year". Expected one of: day, week, month.',
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on an invalid string date', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.getRevenueStatistics({ dateFrom: '01.06.2026' })).rejects.toThrow(
      'Invalid date format: "01.06.2026". Expected YYYY-MM-DD.',
    );
    expect(client.requests).toHaveLength(0);
  });
});

describe('EReportingEndpoint.createEnrollment', () => {
  it('POSTs the snake_case body and returns a ComplianceEnrollment on 201', async () => {
    const { endpoint, client } = makeEndpoint([envelope(ENROLLMENT_PAYLOAD, 201)]);

    const enrollment = await endpoint.createEnrollment({
      country: 'FR',
      siret: '12345678900012',
      vatNumber: 'FR32123456789',
      companyName: 'Acme SARL',
      address: '10 Rue de la Paix',
      city: 'Paris',
      postalcode: '75001',
      province: 'Île-de-France',
      email: 'tax@acme.fr',
      nafCode: '47',
      enterpriseSize: 'pme',
      typeOperation: 'mixed',
      reportingStartDate: new Date('2026-09-01T00:00:00'),
      autoActivate: false,
    });

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/compliance/enrollments`);
    const body = JSON.parse(req.options?.body as string);
    expect(body).toEqual({
      email: 'tax@acme.fr',
      naf_code: '47',
      enterprise_size: 'pme',
      type_operation: 'mixed',
      reporting_start_date: '2026-09-01',
      country: 'FR',
      siret: '12345678900012',
      vat_number: 'FR32123456789',
      company_name: 'Acme SARL',
      address: '10 Rue de la Paix',
      city: 'Paris',
      postalcode: '75001',
      province: 'Île-de-France',
      auto_activate: false,
    });

    expect(enrollment).toBeInstanceOf(ComplianceEnrollment);
    expect(enrollment.id).toBe(12);
    expect(enrollment.companyId).toBe(42);
    expect(enrollment.status).toBe(ComplianceEnrollmentStatus.REGIME_ACTIVATED);
    expect(enrollment.statusLabel).toBe('Regime activated');
    expect(enrollment.statusError).toBeNull();
    expect(enrollment.providerAccountId).toBe('83428');
    expect(enrollment.regimeConfig).toEqual({ naf_code: '47', enterprise_size: 'pme', type_operation: 'mixed' });
    expect(enrollment.reportingStartDate).toBe('2026-09-01');
    expect(enrollment.autoSend).toBe(true);
  });

  it('accepts siren instead of siret and omits undefined optionals', async () => {
    const { endpoint, client } = makeEndpoint([envelope(ENROLLMENT_PAYLOAD, 201)]);

    await endpoint.createEnrollment({ ...validEnrollmentInput(), siret: undefined, siren: '123456789' });

    const body = JSON.parse(client.requests[0]!.options?.body as string);
    expect(body.siren).toBe('123456789');
    expect(body).not.toHaveProperty('siret');
    expect(body).not.toHaveProperty('country');
    expect(body).not.toHaveProperty('auto_activate');
  });

  it('throws TaxoraException without a request when both siret and siren are missing', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(
      endpoint.createEnrollment({ ...validEnrollmentInput(), siret: undefined, siren: undefined }),
    ).rejects.toThrow('Either siret or siren is required.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on wrong siret/siren lengths', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.createEnrollment({ ...validEnrollmentInput(), siret: '123' })).rejects.toThrow(
      'siret must be exactly 14 characters.',
    );
    await expect(
      endpoint.createEnrollment({ ...validEnrollmentInput(), siret: undefined, siren: '1234' }),
    ).rejects.toThrow('siren must be exactly 9 characters.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on an invalid email', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.createEnrollment({ ...validEnrollmentInput(), email: '   ' })).rejects.toThrow(
      'email must be a valid email address.',
    );
    await expect(endpoint.createEnrollment({ ...validEnrollmentInput(), email: 'not-an-email' })).rejects.toThrow(
      'email must be a valid email address.',
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on an invalid nafCode', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.createEnrollment({ ...validEnrollmentInput(), nafCode: '4' })).rejects.toThrow(
      'nafCode must be exactly 2 digits, e.g. "47".',
    );
    await expect(endpoint.createEnrollment({ ...validEnrollmentInput(), nafCode: '47.11D' })).rejects.toThrow(
      TaxoraException,
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on invalid enterpriseSize / typeOperation / country / date', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(
      endpoint.createEnrollment({ ...validEnrollmentInput(), enterpriseSize: 'huge' as ComplianceEnterpriseSize }),
    ).rejects.toThrow('Invalid enterpriseSize "huge". Expected one of: micro, pme, eti, ge.');
    await expect(
      endpoint.createEnrollment({
        ...validEnrollmentInput(),
        typeOperation: 'stuff' as CreateComplianceEnrollmentInput['typeOperation'],
      }),
    ).rejects.toThrow('Invalid typeOperation "stuff". Expected one of: services, goods, mixed.');
    await expect(endpoint.createEnrollment({ ...validEnrollmentInput(), country: 'FRA' })).rejects.toThrow(
      'country must be a 2-character ISO 3166-1 alpha-2 code.',
    );
    await expect(
      endpoint.createEnrollment({ ...validEnrollmentInput(), reportingStartDate: '01.09.2026' }),
    ).rejects.toThrow('Invalid date format: "01.09.2026". Expected YYYY-MM-DD.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException with mapped errors on 422', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        { message: 'Validation failed', errors: { siret: ['The siret field must be 14 characters.'] } },
        422,
      ),
    ]);

    const error = await endpoint.createEnrollment(validEnrollmentInput()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).getErrors()).toEqual({ siret: ['The siret field must be 14 characters.'] });
  });

  it('throws HttpException on a 502 provider error', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ error: 'Provider error: account creation failed' }, 502),
    ]);

    const error = await endpoint.createEnrollment(validEnrollmentInput()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(502);
    expect((error as HttpException).getResponseBody()).toContain('account creation failed');
  });
});

describe('EReportingEndpoint.listEnrollments', () => {
  it('GETs the default pagination and unwraps the double envelope', async () => {
    const { endpoint, client } = makeEndpoint([
      pageEnvelope([ENROLLMENT_PAYLOAD], { current_page: 1, per_page: 25, total: 3, last_page: 1 }),
    ]);

    const page = await endpoint.listEnrollments();

    expect(client.requests[0]!.method).toBe('GET');
    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/enrollments?page=1&per_page=25`);

    expect(page).toBeInstanceOf(ComplianceEnrollmentPage);
    expect(page.length).toBe(1);
    expect(page.currentPage).toBe(1);
    expect(page.perPage).toBe(25);
    expect(page.total).toBe(3);
    expect(page.lastPage).toBe(1);
    expect(page.rows[0]!.status).toBe(ComplianceEnrollmentStatus.REGIME_ACTIVATED);
    expect([...page]).toHaveLength(1);
  });

  it('includes non-default pagination in the query string', async () => {
    const { endpoint, client } = makeEndpoint([pageEnvelope([], {})]);

    await endpoint.listEnrollments(3, 50);

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/enrollments?page=3&per_page=50`);
  });

  it('falls back to defaults on an empty page without meta', async () => {
    const { endpoint } = makeEndpoint([pageEnvelope([], {})]);

    const page = await endpoint.listEnrollments();

    expect(page.length).toBe(0);
    expect(page.currentPage).toBe(1);
    expect(page.perPage).toBe(0);
    expect(page.total).toBe(0);
    expect(page.lastPage).toBe(1);
  });
});

describe('EReportingEndpoint.getEnrollment', () => {
  it('GETs a single enrollment and coerces an unrecognized status to unknown', async () => {
    const { endpoint, client } = makeEndpoint([envelope({ ...ENROLLMENT_PAYLOAD, status: 'brand-new-status' })]);

    const enrollment = await endpoint.getEnrollment(12);

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/enrollments/12`);
    expect(enrollment.status).toBe(ComplianceEnrollmentStatus.UNKNOWN);
  });

  it('throws TaxoraException without a request on a non-positive id', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.getEnrollment(0)).rejects.toThrow('id must be a positive integer.');
    await expect(endpoint.getEnrollment(-3)).rejects.toThrow(TaxoraException);
    expect(client.requests).toHaveLength(0);
  });

  it('throws HttpException on 404', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ error: 'Enrollment not found' }, 404)]);

    const error = await endpoint.getEnrollment(999).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(404);
  });
});

describe('EReportingEndpoint.sireneLookup', () => {
  it('GETs /compliance/sirene-lookup with the URL-encoded query and returns a SireneLookupResult', async () => {
    const { endpoint, client } = makeEndpoint([
      envelope({
        company_name: 'Acme SARL',
        siren: '123456789',
        siret: '12345678900012',
        naf_code: '47',
        naf_full: '47.11D',
        enterprise_size: 'pme',
        address: '10 Rue de la Paix',
        city: 'Paris',
        postalcode: '75001',
      }),
    ]);

    const result = await endpoint.sireneLookup('123 456 789');

    expect(client.requests[0]!.method).toBe('GET');
    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/sirene-lookup?q=123+456+789`);

    expect(result).toBeInstanceOf(SireneLookupResult);
    expect(result.companyName).toBe('Acme SARL');
    expect(result.siren).toBe('123456789');
    expect(result.siret).toBe('12345678900012');
    expect(result.nafCode).toBe('47');
    expect(result.nafFull).toBe('47.11D');
    expect(result.enterpriseSize).toBe('pme');
    expect(result.postalcode).toBe('75001');
  });

  it('maps missing optional fields to null', async () => {
    const { endpoint } = makeEndpoint([envelope({ company_name: 'Acme SARL', siren: '123456789' })]);

    const result = await endpoint.sireneLookup('FR32123456789');

    expect(result.siret).toBeNull();
    expect(result.nafCode).toBeNull();
    expect(result.enterpriseSize).toBeNull();
    expect(result.address).toBeNull();
  });

  it('throws TaxoraException without a request when q is empty', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.sireneLookup('   ')).rejects.toThrow('q must not be empty.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException on a 422 (unextractable SIREN)', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ error: 'Could not extract a valid 9-digit SIREN from the input.' }, 422),
    ]);

    const error = await endpoint.sireneLookup('nonsense').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).message).toBe('Could not extract a valid 9-digit SIREN from the input.');
  });

  it('throws HttpException on a 429 rate limit', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ message: 'Too Many Attempts.' }, 429)]);

    const error = await endpoint.sireneLookup('123456789').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(429);
  });
});

describe('EReportingEndpoint.createTransaction', () => {
  it('POSTs the snake_case body with nested invoice_lines_attributes/taxes_attributes and returns the DTO on 201', async () => {
    const { endpoint, client } = makeEndpoint([envelope(TRANSACTION_PAYLOAD, 201)]);

    const tx = await endpoint.createTransaction({
      complianceEnrollmentId: 12,
      transactionType: 'crossborder_outbound',
      invoiceNumber: 'TKT-2026-00001',
      invoiceDate: new Date('2026-07-01T00:00:00'),
      dueDate: '2026-07-31',
      currency: 'EUR',
      subtotal: 100,
      taxAmount: 20,
      total: 120,
      counterpartyName: 'Kunde GmbH',
      counterpartyCountry: 'de',
      counterpartyVatNumber: 'DE123456789',
      providerContactId: 'contact-1',
      invoiceLines: [
        {
          description: 'Ticket',
          quantity: 2,
          price: 50,
          unit: 9,
          taxes: [{ name: 'TVA', percent: 0, category: 'E', comment: 'VATEX-EU-O' }],
        },
      ],
      paymentMethod: 1,
      remittanceInformation: 'RF18 5390 0754 7034',
      paymentMethodText: 'Bank transfer',
      paymentTerms: '30 days net',
      submitNow: false,
    });

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/compliance/transactions`);
    const body = JSON.parse(req.options?.body as string);
    expect(body).toEqual({
      compliance_enrollment_id: 12,
      transaction_type: 'crossborder_outbound',
      invoice_number: 'TKT-2026-00001',
      invoice_date: '2026-07-01',
      due_date: '2026-07-31',
      currency: 'EUR',
      subtotal: 100,
      tax_amount: 20,
      total: 120,
      counterparty_name: 'Kunde GmbH',
      counterparty_country: 'de',
      counterparty_vat_number: 'DE123456789',
      provider_contact_id: 'contact-1',
      invoice_lines_attributes: [
        {
          description: 'Ticket',
          quantity: 2,
          price: 50,
          unit: 9,
          taxes_attributes: [{ name: 'TVA', percent: 0, category: 'E', comment: 'VATEX-EU-O' }],
        },
      ],
      payment_method: 1,
      remittance_information: 'RF18 5390 0754 7034',
      payment_method_text: 'Bank transfer',
      payment_terms: '30 days net',
      submit_now: false,
    });

    expect(tx).toBeInstanceOf(ComplianceTransaction);
    expect(tx.id).toBe(99);
    expect(tx.transactionType).toBe(ComplianceTransactionType.B2C_OUTBOUND);
    expect(tx.state).toBe(ComplianceTransactionState.SUBMITTED);
    expect(tx.subtotal).toBe('100.00');
    expect(tx.taxAmount).toBe('20.00');
    expect(tx.total).toBe('120.00');
    expect(tx.taxReport).toBeInstanceOf(ComplianceTaxReport);
    expect(tx.taxReport!.state).toBe(ComplianceTaxReportState.REGISTERED);
  });

  it('accepts a 200 idempotent replay of an already-recorded invoice', async () => {
    const { endpoint } = makeEndpoint([envelope(TRANSACTION_PAYLOAD, 200)]);

    const tx = await endpoint.createTransaction(validTransactionInput());

    expect(tx.id).toBe(99);
    expect(tx.invoiceNumber).toBe('TKT-2026-00001');
  });

  it('omits undefined optional fields from the body', async () => {
    const { endpoint, client } = makeEndpoint([envelope(TRANSACTION_PAYLOAD, 201)]);

    await endpoint.createTransaction(validTransactionInput());

    const body = JSON.parse(client.requests[0]!.options?.body as string);
    expect(Object.keys(body).sort()).toEqual([
      'compliance_enrollment_id',
      'invoice_date',
      'invoice_lines_attributes',
      'invoice_number',
      'subtotal',
      'total',
      'transaction_type',
    ]);
    expect(body.invoice_lines_attributes[0]).not.toHaveProperty('unit');
    expect(body.invoice_lines_attributes[0].taxes_attributes[0]).not.toHaveProperty('comment');
  });

  it('throws TaxoraException without a request on an invalid transactionType', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(
      endpoint.createTransaction({
        ...validTransactionInput(),
        transactionType: 'b2x_sideways' as ComplianceTransactionRequestType,
      }),
    ).rejects.toThrow(
      'Invalid transactionType "b2x_sideways". Expected one of: b2c_outbound, b2b_domestic_outbound, ' +
        'b2b_domestic_inbound, crossborder_outbound, crossborder_inbound.',
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on an invalid invoiceNumber', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.createTransaction({ ...validTransactionInput(), invoiceNumber: '  ' })).rejects.toThrow(
      'invoiceNumber must not be empty.',
    );
    await expect(
      endpoint.createTransaction({ ...validTransactionInput(), invoiceNumber: 'X'.repeat(51) }),
    ).rejects.toThrow('invoiceNumber must not exceed 50 characters.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on empty lines or taxes (with the failing index)', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.createTransaction({ ...validTransactionInput(), invoiceLines: [] })).rejects.toThrow(
      'invoiceLines must contain at least one line.',
    );
    await expect(
      endpoint.createTransaction({
        ...validTransactionInput(),
        invoiceLines: [
          { description: 'A', quantity: 1, price: 10, taxes: [{ name: 'TVA', percent: 20, category: 'S' }] },
          { description: 'B', quantity: 1, price: 10, taxes: [] },
        ],
      }),
    ).rejects.toThrow('invoiceLines[1].taxes must contain at least one tax.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request on invalid currency / counterpartyCountry / enrollment id', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.createTransaction({ ...validTransactionInput(), currency: 'EURO' })).rejects.toThrow(
      'currency must be a 3-character ISO 4217 code.',
    );
    await expect(
      endpoint.createTransaction({ ...validTransactionInput(), counterpartyCountry: 'DEU' }),
    ).rejects.toThrow('counterpartyCountry must be a 2-character ISO 3166-1 alpha-2 code.');
    await expect(endpoint.createTransaction({ ...validTransactionInput(), complianceEnrollmentId: 0 })).rejects.toThrow(
      'complianceEnrollmentId must be a positive integer.',
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException with the error bag on 422', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        {
          message: 'Validation failed',
          errors: { 'invoice_lines_attributes.0.taxes_attributes.0.comment': ['A VATEX code is required.'] },
        },
        422,
      ),
    ]);

    const error = await endpoint.createTransaction(validTransactionInput()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).getErrors()).toEqual({
      'invoice_lines_attributes.0.taxes_attributes.0.comment': ['A VATEX code is required.'],
    });
  });

  it('throws HttpException on a 502 provider error', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ error: 'Provider error: invoice rejected' }, 502),
    ]);

    const error = await endpoint.createTransaction(validTransactionInput()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(502);
  });
});

describe('EReportingEndpoint.listTransactions', () => {
  it('GETs without a query string when no filters are given', async () => {
    const { endpoint, client } = makeEndpoint([pageEnvelope([], {})]);

    await endpoint.listTransactions();

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/transactions`);
  });

  it('serializes all filters as snake_case query params (Date objects formatted)', async () => {
    const { endpoint, client } = makeEndpoint([
      pageEnvelope([TRANSACTION_PAYLOAD], { current_page: 2, per_page: 10, total: 21, last_page: 3 }),
    ]);

    const page = await endpoint.listTransactions({
      dateFrom: new Date('2026-01-01T00:00:00'),
      dateTo: '2026-06-30',
      state: 'submitted',
      transactionType: 'b2c_outbound',
      page: 2,
      perPage: 10,
    });

    expect(client.requests[0]!.url).toBe(
      `${BASE_URL}/compliance/transactions` +
        '?date_from=2026-01-01&date_to=2026-06-30&state=submitted&transaction_type=b2c_outbound&page=2&per_page=10',
    );

    expect(page).toBeInstanceOf(ComplianceTransactionPage);
    expect(page.length).toBe(1);
    expect(page.currentPage).toBe(2);
    expect(page.total).toBe(21);
    expect(page.lastPage).toBe(3);
    expect(page.rows[0]!.taxReport?.id).toBe(7);
  });

  it('coerces unrecognized state/type in rows to unknown', async () => {
    const { endpoint } = makeEndpoint([
      pageEnvelope(
        [{ ...TRANSACTION_PAYLOAD, state: 'teleporting', transaction_type: 'b2x_sideways', tax_report: null }],
        {},
      ),
    ]);

    const page = await endpoint.listTransactions();

    expect(page.rows[0]!.state).toBe(ComplianceTransactionState.UNKNOWN);
    expect(page.rows[0]!.transactionType).toBe(ComplianceTransactionType.UNKNOWN);
    expect(page.rows[0]!.taxReport).toBeUndefined();
  });

  it('throws TaxoraException without a request on an invalid string date', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.listTransactions({ dateFrom: '2026/01/01' })).rejects.toThrow(
      'Invalid date format: "2026/01/01". Expected YYYY-MM-DD.',
    );
    expect(client.requests).toHaveLength(0);
  });
});

describe('EReportingEndpoint.getTransaction', () => {
  it('GETs a single transaction by id', async () => {
    const { endpoint, client } = makeEndpoint([envelope(TRANSACTION_PAYLOAD)]);

    const tx = await endpoint.getTransaction(99);

    expect(client.requests[0]!.method).toBe('GET');
    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/transactions/99`);
    expect(tx.invoiceNumber).toBe('TKT-2026-00001');
    expect(tx.reportedAt).toBe('2026-07-02T00:00:00+00:00');
  });

  it('throws TaxoraException without a request on a non-positive id', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.getTransaction(0)).rejects.toThrow('id must be a positive integer.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws HttpException on invalid JSON', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.textResponse('<html>oops</html>')]);

    await expect(endpoint.getTransaction(99)).rejects.toThrow('Invalid JSON response');
  });
});

describe('EReportingEndpoint.updateTransaction', () => {
  it('PUTs only the provided fields', async () => {
    const { endpoint, client } = makeEndpoint([envelope(TRANSACTION_PAYLOAD)]);

    const tx = await endpoint.updateTransaction(99, {
      invoiceNumber: 'TKT-2026-00002',
      total: 130,
      invoiceLines: [
        { description: 'Ticket', quantity: 1, price: 130, taxes: [{ name: 'TVA', percent: 20, category: 'S' }] },
      ],
    });

    const req = client.requests[0]!;
    expect(req.method).toBe('PUT');
    expect(req.url).toBe(`${BASE_URL}/compliance/transactions/99`);
    const body = JSON.parse(req.options?.body as string);
    expect(body).toEqual({
      invoice_number: 'TKT-2026-00002',
      total: 130,
      invoice_lines_attributes: [
        {
          description: 'Ticket',
          quantity: 1,
          price: 130,
          taxes_attributes: [{ name: 'TVA', percent: 20, category: 'S' }],
        },
      ],
    });

    expect(tx).toBeInstanceOf(ComplianceTransaction);
  });

  it('throws TaxoraException without a request on invalid provided fields', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.updateTransaction(99, { invoiceNumber: '' })).rejects.toThrow(
      'invoiceNumber must not be empty.',
    );
    await expect(endpoint.updateTransaction(99, { invoiceLines: [] })).rejects.toThrow(
      'invoiceLines must contain at least one line.',
    );
    await expect(endpoint.updateTransaction(0, {})).rejects.toThrow('id must be a positive integer.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException when the transaction is no longer pending (422)', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ error: 'Only pending transactions can be edited' }, 422),
    ]);

    const error = await endpoint.updateTransaction(99, { total: 130 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).message).toBe('Only pending transactions can be edited');
  });
});

describe('EReportingEndpoint.deleteTransaction', () => {
  it('DELETEs and resolves void on a body-less 204', async () => {
    const { endpoint, client } = makeEndpoint([new Response(null, { status: 204 })]);

    await expect(endpoint.deleteTransaction(99)).resolves.toBeUndefined();

    const req = client.requests[0]!;
    expect(req.method).toBe('DELETE');
    expect(req.url).toBe(`${BASE_URL}/compliance/transactions/99`);
    expect(req.options?.body).toBeUndefined();
  });

  it('throws TaxoraException without a request on a non-positive id', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.deleteTransaction(-1)).rejects.toThrow('id must be a positive integer.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException when the transaction is no longer pending (422)', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ error: 'Only pending transactions can be deleted' }, 422),
    ]);

    const error = await endpoint.deleteTransaction(99).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).message).toBe('Only pending transactions can be deleted');
  });

  it('throws HttpException on 404', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ error: 'Transaction not found' }, 404)]);

    const error = await endpoint.deleteTransaction(99).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(404);
  });
});

describe('EReportingEndpoint.submitTransaction', () => {
  it('POSTs to /compliance/transactions/{id}/submit and returns the updated DTO', async () => {
    const { endpoint, client } = makeEndpoint([envelope(TRANSACTION_PAYLOAD)]);

    const tx = await endpoint.submitTransaction(99);

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/compliance/transactions/99/submit`);
    expect(req.options?.body).toBeUndefined();
    expect(tx.state).toBe(ComplianceTransactionState.SUBMITTED);
    expect(tx.providerInvoiceId).toBe('inv-123');
  });

  it('throws TaxoraException without a request on a non-positive id', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.submitTransaction(0)).rejects.toThrow('id must be a positive integer.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException when the transaction is already submitted (422)', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ error: 'Transaction is already submitted and cannot be re-submitted' }, 422),
    ]);

    const error = await endpoint.submitTransaction(99).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).message).toBe('Transaction is already submitted and cannot be re-submitted');
  });

  it('throws HttpException on a 502 provider error', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ error: 'Provider error: timeout' }, 502)]);

    const error = await endpoint.submitTransaction(99).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(502);
  });
});

describe('EReportingEndpoint.importTransactions', () => {
  const CSV_CONTENT =
    'invoice_number;invoice_date;transaction_type;subtotal;total;line_description;line_quantity;line_price;tax_name;tax_percent;tax_category\n' +
    'INV-1;2026-07-01;b2c_outbound;100;120;Ticket;1;100;TVA;20;S\n';

  it('POSTs multipart form data with the enrollment id and CSV file', async () => {
    const { endpoint, client } = makeEndpoint([
      envelope({ created: 1, skipped_duplicates: 2, errors: ['Row 3 (INV-2): column count mismatch'] }),
    ]);

    const result = await endpoint.importTransactions(12, CSV_CONTENT, 'july.csv');

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/compliance/transactions/import`);

    const form = req.options?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('compliance_enrollment_id')).toBe('12');
    const file = form.get('file') as File;
    expect(file.name).toBe('july.csv');
    expect(await file.text()).toBe(CSV_CONTENT);

    // Content-Type must be left to fetch so the multipart boundary is set.
    const headers = req.options?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['x-api-key']).toBe(API_KEY);
    expect(headers['Authorization']).toBe('Bearer test-token');

    expect(result).toBeInstanceOf(ImportResult);
    expect(result.created).toBe(1);
    expect(result.skippedDuplicates).toBe(2);
    expect(result.errors).toEqual(['Row 3 (INV-2): column count mismatch']);
  });

  it('defaults the filename to transactions.csv', async () => {
    const { endpoint, client } = makeEndpoint([envelope({ created: 1, skipped_duplicates: 0, errors: [] })]);

    await endpoint.importTransactions(12, CSV_CONTENT);

    const form = client.requests[0]!.options?.body as FormData;
    expect((form.get('file') as File).name).toBe('transactions.csv');
  });

  it('throws TaxoraException without a request on empty content or a non-positive enrollment id', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.importTransactions(12, '   ')).rejects.toThrow('csvContent must not be empty.');
    await expect(endpoint.importTransactions(0, CSV_CONTENT)).rejects.toThrow(
      'enrollmentId must be a positive integer.',
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException on 422 (missing columns)', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ error: 'Missing CSV columns: tax_category' }, 422),
    ]);

    const error = await endpoint.importTransactions(12, CSV_CONTENT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).message).toBe('Missing CSV columns: tax_category');
  });
});

describe('EReportingEndpoint.getVatRates', () => {
  const VAT_RATES_PAYLOAD = {
    country: 'FR',
    currency: 'EUR',
    rates: [
      { percent: 20, category: 'S', label_key: 'fr_standard', tax_name: 'TVA' },
      { percent: 0, category: 'E', label_key: 'exempt', tax_name: 'TVA', requires_vatex: true },
    ],
  };

  it('GETs /compliance/vat-rates without a query when no country is given', async () => {
    const { endpoint, client } = makeEndpoint([envelope(VAT_RATES_PAYLOAD)]);

    const rates = await endpoint.getVatRates();

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/vat-rates`);

    expect(rates).toBeInstanceOf(VatRates);
    expect(rates.country).toBe('FR');
    expect(rates.currency).toBe('EUR');
    expect(rates.rates).toHaveLength(2);
    expect(rates.rates[0]).toEqual({
      percent: 20,
      category: 'S',
      labelKey: 'fr_standard',
      taxName: 'TVA',
      requiresVatex: false,
    });
    expect(rates.rates[1]!.requiresVatex).toBe(true);
  });

  it('passes the country as a query param', async () => {
    const { endpoint, client } = makeEndpoint([envelope(VAT_RATES_PAYLOAD)]);

    await endpoint.getVatRates('FR');

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/vat-rates?country=FR`);
  });

  it('throws HttpException on 403 when the feature is not granted', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ error: 'Forbidden' }, 403)]);

    const error = await endpoint.getVatRates().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(403);
  });
});

describe('EReportingEndpoint.listTaxReports', () => {
  it('GETs the default pagination and unwraps the double envelope', async () => {
    const { endpoint, client } = makeEndpoint([
      pageEnvelope([TAX_REPORT_PAYLOAD], { current_page: 1, per_page: 25, total: 1, last_page: 1 }),
    ]);

    const page = await endpoint.listTaxReports();

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/tax-reports?page=1&per_page=25`);

    expect(page).toBeInstanceOf(ComplianceTaxReportPage);
    expect(page.length).toBe(1);
    expect(page.rows[0]!.state).toBe(ComplianceTaxReportState.REGISTERED);
    expect(page.rows[0]!.isTerminal).toBe(true);
    expect(page.rows[0]!.baseAmount).toBe('100.00');
    expect(page.rows[0]!.totalAmount).toBe('120.00');
  });

  it('includes the state filter in the query string', async () => {
    const { endpoint, client } = makeEndpoint([pageEnvelope([], {})]);

    await endpoint.listTaxReports(2, 10, 'refused');

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/tax-reports?page=2&per_page=10&state=refused`);
  });

  it('falls back to defaults on an empty page without meta', async () => {
    const { endpoint } = makeEndpoint([pageEnvelope([], {})]);

    const page = await endpoint.listTaxReports();

    expect(page.length).toBe(0);
    expect(page.currentPage).toBe(1);
    expect(page.perPage).toBe(0);
    expect(page.total).toBe(0);
    expect(page.lastPage).toBe(1);
  });
});

describe('EReportingEndpoint.getTaxReport', () => {
  it('GETs a single tax report and coerces an unrecognized state to unknown', async () => {
    const { endpoint, client } = makeEndpoint([envelope({ ...TAX_REPORT_PAYLOAD, state: 'vaporized' })]);

    const report = await endpoint.getTaxReport(7);

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/compliance/tax-reports/7`);
    expect(report).toBeInstanceOf(ComplianceTaxReport);
    expect(report.state).toBe(ComplianceTaxReportState.UNKNOWN);
    expect(report.complianceTransactionId).toBe(99);
    expect(report.refusalReason).toBeNull();
  });

  it('throws TaxoraException without a request on a non-positive id', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.getTaxReport(0)).rejects.toThrow('id must be a positive integer.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws HttpException on a 500 error', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ message: 'Internal Server Error' }, 500)]);

    await expect(endpoint.getTaxReport(7)).rejects.toThrow(HttpException);
  });
});

describe('EReportingEndpoint.requestEReportingAccess', () => {
  it('POSTs the provided fields and resolves void', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true })]);

    await expect(
      endpoint.requestEReportingAccess({
        name: 'Max Mustermann',
        email: 'max@example.com',
        company: 'Example GmbH',
        phone: '+43 660 1234567',
        message: 'Please activate e-reporting.',
        language: 'de',
      }),
    ).resolves.toBeUndefined();

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/compliance/e-reporting-request`);
    expect(JSON.parse(req.options?.body as string)).toEqual({
      name: 'Max Mustermann',
      email: 'max@example.com',
      company: 'Example GmbH',
      phone: '+43 660 1234567',
      message: 'Please activate e-reporting.',
      language: 'de',
    });
  });

  it('sends an empty body when called without input', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true })]);

    await endpoint.requestEReportingAccess();

    expect(JSON.parse(client.requests[0]!.options?.body as string)).toEqual({});
  });

  it('throws HttpException when the API rejects the request (400)', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ error: 'Email is required.' }, 400)]);

    const error = await endpoint.requestEReportingAccess().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(400);
  });
});

import { describe, it, expect } from 'vitest';
import { VatEndpoint } from '../../src/endpoints/VatEndpoint.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { VatResource } from '../../src/dto/VatResource.js';
import { VatCollection } from '../../src/dto/VatCollection.js';
import { VatCertificateExport } from '../../src/dto/VatCertificateExport.js';
import { VatValidationAddressInput } from '../../src/dto/VatValidationAddressInput.js';
import { LocalTaxNumberRow, parseLocalTaxNumbersCsv } from '../../src/dto/LocalTaxNumberReport.js';
import { Language } from '../../src/enums/Language.js';
import { HttpException } from '../../src/exceptions/HttpException.js';
import { ValidationException } from '../../src/exceptions/ValidationException.js';
import { RetryPolicy } from '../../src/http/RetryPolicy.js';
import { TaxoraException } from '../../src/exceptions/TaxoraException.js';
import { VatRegisterFacts } from '../../src/dto/VatRegisterFacts.js';
import { RegisterFactsStatus } from '../../src/enums/RegisterFactsStatus.js';
import { registerNoteText } from '../../src/dto/RegisterFacts.js';

const BASE_URL = 'https://sandbox.taxora.io/v1';
const API_KEY = 'test-api-key';

const VAT_RESPONSE = {
  success: true,
  data: {
    uuid: 'uuid-123',
    vat_uid: 'ATU12345678',
    state: 'valid',
    provider_valid: true,
    company_name: 'Alpha Handels GmbH',
    environment: 'SANDBOX',
    has_api_error: true,
    error_message: 'Official registry temporarily unavailable',
    next_api_recheck_at: '2026-04-24T14:00:00Z',
  },
};

function makeEndpoint(responses: (Response | Error)[], retryPolicy?: RetryPolicy) {
  const storage = new InMemoryTokenStorage();
  const token = new Token('test-token', 'Bearer', new Date(Date.now() + 3600_000));
  storage.set(token);
  const client = new SequenceHttpClient(responses);
  // No waiting between attempts: the backoff itself is covered in RetryPolicy.test.ts.
  const endpoint = new VatEndpoint(BASE_URL, API_KEY, storage, client, retryPolicy ?? RetryPolicy.withoutDelay());
  return { endpoint, storage, client };
}

describe('VatEndpoint.validate', () => {
  it('sends POST to /vat/validate and returns VatResource', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    const result = await endpoint.validate('ATU12345678');

    expect(result).toBeInstanceOf(VatResource);
    expect(result.vatUid).toBe('ATU12345678');
    expect(result.providerValid).toBe(true);
    expect(result.hasApiError).toBe(true);
    expect(result.errorMessage).toBe('Official registry temporarily unavailable');
    expect(result.nextApiRecheckAt).toBe('2026-04-24T14:00:00Z');

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/vat/validate`);

    const body = JSON.parse(req.options?.body as string);
    expect(body.vat_uid).toBe('ATU12345678');
  });

  it('includes optional companyName and provider', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    await endpoint.validate('ATU12345678', 'Alpha Handels GmbH', 'vies');

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.company_name).toBe('Alpha Handels GmbH');
    expect(body.source).toBe('vies');
  });

  it('accepts VatValidationAddressInput object', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    const addressInput = new VatValidationAddressInput({
      addressLine1: 'Ringstraße 1',
      city: 'Wien',
      countryCode: 'AT',
    });
    await endpoint.validate('ATU12345678', undefined, undefined, addressInput);

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.address_input).toEqual({
      address_line_1: 'Ringstraße 1',
      city: 'Wien',
      country_code: 'AT',
    });
  });

  it('accepts plain object for addressInput', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    await endpoint.validate('ATU12345678', undefined, undefined, { address_line_1: 'Via Roma 25', country_code: 'IT' });

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.address_input).toBeDefined();
  });

  it('retries on 504 and returns VatResource on success', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Gateway Timeout' }, 504),
      SequenceHttpClient.jsonResponse(VAT_RESPONSE),
    ]);

    const result = await endpoint.validate('ATU12345678');
    expect(result).toBeInstanceOf(VatResource);
    expect(client.requests).toHaveLength(2);
  });

  it('throws HttpException with clean message after exhausting retries', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Gateway Timeout' }, 504),
      SequenceHttpClient.jsonResponse({ message: 'Gateway Timeout' }, 504),
      SequenceHttpClient.jsonResponse({ message: 'Gateway Timeout' }, 504),
    ]);

    await expect(endpoint.validate('ATU12345678')).rejects.toThrow(HttpException);
    expect(client.requests).toHaveLength(3);
  });

  it('retries a rate limit only when the API says how long to wait', async () => {
    const slept: number[] = [];
    const policy = new RetryPolicy({ sleeper: (ms) => void slept.push(ms) });

    const { endpoint, client } = makeEndpoint(
      [
        new Response(JSON.stringify({ message: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '2' },
        }),
        SequenceHttpClient.jsonResponse(VAT_RESPONSE),
      ],
      policy,
    );

    const result = await endpoint.validate('ATU12345678');

    expect(result).toBeInstanceOf(VatResource);
    expect(client.requests).toHaveLength(2);
    expect(slept).toEqual([2000]);
  });

  it('fails immediately on a rate limit without Retry-After', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ message: 'Too Many Requests' }, 429)]);

    const error = await endpoint.validate('ATU12345678').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatusCode()).toBe(429);
    expect((error as HttpException).message).toBe('Too Many Requests');
    expect(client.requests).toHaveLength(1);
  });

  it('fails immediately when Retry-After is longer than the cap', async () => {
    const { endpoint, client } = makeEndpoint([
      new Response('<html><body>504</body></html>', {
        status: 504,
        headers: { 'Content-Type': 'text/html', 'Retry-After': '120' },
      }),
    ]);

    const error = await endpoint.validate('ATU12345678').catch((e: unknown) => e);

    expect((error as HttpException).getRetryAfter()).toBe('120');
    expect(client.requests).toHaveLength(1);
  });

  it('retries a transport failure and rethrows it unchanged when the attempts run out', async () => {
    const recovered = makeEndpoint([SequenceHttpClient.networkError(), SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    expect(await recovered.endpoint.validate('ATU12345678')).toBeInstanceOf(VatResource);
    expect(recovered.client.requests).toHaveLength(2);

    const exhausted = makeEndpoint([
      SequenceHttpClient.networkError(),
      SequenceHttpClient.networkError(),
      SequenceHttpClient.networkError(),
    ]);

    const error = await exhausted.endpoint.validate('ATU12345678').catch((e: unknown) => e);

    // Callers keep seeing their own HTTP client's error.
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toBe('fetch failed');
    expect(exhausted.client.requests).toHaveLength(3);
  });

  it('can turn retrying off completely', async () => {
    // Callers that do their own retrying (queue workers, cron jobs) opt out with
    // RetryPolicy.disabled() and get the failure on the first attempt.
    const { endpoint, client } = makeEndpoint(
      [SequenceHttpClient.textResponse('<html><body>504</body></html>', 504, 'text/html')],
      RetryPolicy.disabled(),
    );

    const error = await endpoint.validate('ATU12345678').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).message).toBe('Taxora API request failed (HTTP 504 Gateway Timeout).');
    expect(client.requests).toHaveLength(1);
  });

  it('honours a custom attempt count', async () => {
    const { endpoint, client } = makeEndpoint(
      [
        SequenceHttpClient.textResponse('<html><body>504</body></html>', 504, 'text/html'),
        SequenceHttpClient.textResponse('<html><body>504</body></html>', 504, 'text/html'),
      ],
      RetryPolicy.withoutDelay(2),
    );

    const error = await endpoint.validate('ATU12345678').catch((e: unknown) => e);

    expect((error as HttpException).message).toBe(
      'Taxora VAT validation failed after 2 attempts (HTTP 504 Gateway Timeout).',
    );
    expect(client.requests).toHaveLength(2);
  });

  it('retries 502 and 503 as well and waits between attempts', async () => {
    const slept: number[] = [];
    const policy = new RetryPolicy({ sleeper: (ms) => void slept.push(ms) });

    const { endpoint, client } = makeEndpoint(
      [
        SequenceHttpClient.textResponse('<html><body>bad gateway</body></html>', 502, 'text/html'),
        SequenceHttpClient.textResponse('<html><body>unavailable</body></html>', 503, 'text/html'),
        SequenceHttpClient.jsonResponse(VAT_RESPONSE),
      ],
      policy,
    );

    const result = await endpoint.validate('ATU12345678');

    expect(result).toBeInstanceOf(VatResource);
    expect(client.requests).toHaveLength(3);
    expect(slept).toEqual([500, 1000]);
  });

  it('does not retry a certificate export, which would duplicate the job', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.textResponse('<html><body>504</body></html>', 504, 'text/html'),
    ]);

    const error = await endpoint.certificatesBulkExport('2024-01-01', '2024-01-31').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).message).toBe('Taxora API request failed (HTTP 504 Gateway Timeout).');
    expect(client.requests).toHaveLength(1);
  });

  it('never puts a gateway HTML error page into the message', async () => {
    const html = [
      '<!DOCTYPE html>',
      '<html><head><meta name="robots" content="noindex"></head>',
      '<body><p class="code">Error code: 504</p>',
      '<p>App Platform failed to forward this request to the application.</p></body></html>',
    ].join('\n');

    const { endpoint } = makeEndpoint([
      SequenceHttpClient.textResponse(html, 504, 'text/html'),
      SequenceHttpClient.textResponse(html, 504, 'text/html'),
      SequenceHttpClient.textResponse(html, 504, 'text/html'),
    ]);

    const error = await endpoint.validate('ATU12345678').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).message).toBe(
      'Taxora VAT validation failed after 3 attempts (HTTP 504 Gateway Timeout).',
    );
    expect((error as HttpException).message).not.toContain('<');
    // The raw page stays available for debugging.
    expect((error as HttpException).getResponseBody()).toBe(html);
  });

  it('surfaces a JSON API message instead of the raw body', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: false, message: 'VAT number is unknown to the provider.' }, 400),
    ]);

    const error = await endpoint.validate('ATU12345678').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).message).toBe('VAT number is unknown to the provider.');
  });

  it('does not retry on non-504 errors', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Internal Server Error' }, 500),
    ]);

    await expect(endpoint.validate('ATU12345678')).rejects.toThrow(HttpException);
    expect(client.requests).toHaveLength(1);
  });

  it('does not retry on 422 validation errors', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Validation failed', errors: { vat_uid: ['Invalid'] } }, 422),
    ]);

    await expect(endpoint.validate('ATU12345678')).rejects.toThrow(ValidationException);
    expect(client.requests).toHaveLength(1);
  });
});

describe('VatEndpoint.validateMultiple', () => {
  it('sends POST to /vat/validate/multiple and returns VatCollection', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: [VAT_RESPONSE.data],
      }),
    ]);

    const result = await endpoint.validateMultiple(['ATU12345678']);
    expect(result).toBeInstanceOf(VatCollection);
    expect(result.length).toBe(1);
  });
});

describe('VatEndpoint.validateSchema', () => {
  it('returns raw array for schema validation', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: { valid: true } })]);

    const result = await endpoint.validateSchema('ATU12345678');
    expect(result).toEqual({ valid: true });
  });
});

describe('VatEndpoint.state', () => {
  it('POST /vat/state with vat_uid returns VatResource', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    const result = await endpoint.state('ATU12345678');
    expect(result).toBeInstanceOf(VatResource);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/state`);
    expect(client.requests[0]?.method).toBe('POST');
    expect(JSON.parse(client.requests[0]?.options?.body as string).vat_uid).toBe('ATU12345678');
  });
});

describe('VatEndpoint.history', () => {
  it('POST /vat/history returns VatCollection', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    const result = await endpoint.history();
    expect(result).toBeInstanceOf(VatCollection);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history`);
  });

  it('POST /vat/history with vatUid filter', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    await endpoint.history('ATU12345678');
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history`);
    expect(client.requests[0]?.method).toBe('POST');
    expect(JSON.parse(client.requests[0]?.options?.body as string).vat_uid).toBe('ATU12345678');
  });
});

describe('VatEndpoint.search', () => {
  it('POST /vat/search returns VatCollection', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    const result = await endpoint.search('Alpha');
    expect(result).toBeInstanceOf(VatCollection);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/search`);
    expect(client.requests[0]?.method).toBe('POST');
    expect(JSON.parse(client.requests[0]?.options?.body as string).search).toBe('Alpha');
  });

  it('includes perPage parameter', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    await endpoint.search('Alpha', 25);
    expect(JSON.parse(client.requests[0]?.options?.body as string).perPage).toBe(25);
  });
});

describe('VatEndpoint.certificate', () => {
  it('POST /vat/certificate with uuid returns binary', async () => {
    const pdfData = new Uint8Array([1, 2, 3, 4]);
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.binaryResponse(pdfData)]);

    const result = await endpoint.certificate('uuid-123');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/certificate`);
    expect(client.requests[0]?.method).toBe('POST');
    expect(JSON.parse(client.requests[0]?.options?.body as string).uuid).toBe('uuid-123');
  });

  it('includes lang parameter when provided', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.binaryResponse(new Uint8Array())]);

    await endpoint.certificate('uuid-123', Language.GERMAN);
    expect(JSON.parse(client.requests[0]?.options?.body as string).lang).toBe('de');
  });
});

describe('VatEndpoint.certificatesBulkExport', () => {
  it('POST with Date objects formatted as YYYY-MM-DD', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: { export_id: 'exp-1' } }, 202),
    ]);

    const result = await endpoint.certificatesBulkExport(new Date('2024-01-01'), new Date('2024-12-31'));

    expect(result).toBeInstanceOf(VatCertificateExport);
    expect(result.exportId).toBe('exp-1');

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.from_date).toBe('2024-01-01');
    expect(body.to_date).toBe('2024-12-31');
  });

  it('accepts string dates in YYYY-MM-DD format', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: { export_id: 'exp-2' } }, 202),
    ]);

    await endpoint.certificatesBulkExport('2024-01-01', '2024-12-31');

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.from_date).toBe('2024-01-01');
    expect(body.to_date).toBe('2024-12-31');
  });

  it('throws on invalid date string format', async () => {
    const { endpoint } = makeEndpoint([]);

    await expect(endpoint.certificatesBulkExport('01/01/2024', '2024-12-31')).rejects.toThrow();
  });

  it('throws when export_id is missing from response', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: {} }, 202)]);

    await expect(endpoint.certificatesBulkExport('2024-01-01', '2024-12-31')).rejects.toThrow();
  });

  it('includes optional countries and lang', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: { export_id: 'exp-3' } }, 202),
    ]);

    await endpoint.certificatesBulkExport('2024-01-01', '2024-12-31', ['AT', 'DE'], Language.GERMAN);

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.countries).toEqual(['AT', 'DE']);
    expect(body.lang).toBe('de');
  });
});

describe('VatEndpoint.certificatesListExport', () => {
  it('POST to /vat/certificates/list-export', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: { export_id: 'list-exp-1' } }, 202),
    ]);

    const result = await endpoint.certificatesListExport('2024-01-01', '2024-12-31');
    expect(result.exportId).toBe('list-exp-1');
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/certificates/list-export`);
  });
});

describe('VatEndpoint.downloadBulkExport', () => {
  it('GET /vat/certificates/download/{id} returns binary', async () => {
    const zipData = new Uint8Array([5, 6, 7, 8]);
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.binaryResponse(zipData)]);

    const result = await endpoint.downloadBulkExport('exp-123');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/certificates/download/exp-123`);
  });
});

const LOCAL_TAX_NUMBERS_CSV =
  '\uFEFF' +
  'companyName,requestedName,country,vatNumber,vatStatus,taxNumber,taxNumberName,taxNumberSource,source,checkedAt,checkId\r\n' +
  '"Eni S.p.A., Roma",,IT,IT00905811006,valid,"\t00905811006","Partita IVA",vat_id,vat_check,2026-10-22T09:15:00+00:00,uuid-1\r\n' +
  '"Fritz ""Schiller"" OHG","Fritz Schiller",DE,,no_vat_id,"\t21815953301",Steuernummer,company_website,smart_enrichment,2026-10-21T08:00:00+00:00,job-2\r\n' +
  '"Unknown GmbH",,AT,,not_found,,,,smart_enrichment,2026-10-20T07:00:00+00:00,job-3\r\n';

describe('VatEndpoint local tax numbers report', () => {
  it('sends the filters and returns the raw CSV', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.textResponse(LOCAL_TAX_NUMBERS_CSV, 200, 'text/csv; charset=UTF-8'),
    ]);

    const csv = await endpoint.localTaxNumbersCsv({
      dateFrom: new Date(2026, 9, 1),
      dateTo: '2026-10-23',
      countries: ['pl', 'IT'],
      onlyWithTaxNumber: true,
    });

    expect(csv).toBe(LOCAL_TAX_NUMBERS_CSV);
    expect(client.requests[0]?.method).toBe('GET');
    expect(client.requests[0]?.url).toBe(
      `${BASE_URL}/reports/local-tax-numbers?date_from=2026-10-01&date_to=2026-10-23&countries%5B%5D=PL&countries%5B%5D=IT&only_with_tax_number=1`,
    );
    const headers = client.requests[0]?.options?.headers as Record<string, string>;
    expect(headers['Accept']).toContain('text/csv');
  });

  it('parses rows, drops the BOM and trims the Excel tab', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.textResponse(LOCAL_TAX_NUMBERS_CSV, 200, 'text/csv; charset=UTF-8'),
    ]);

    const rows = await endpoint.localTaxNumbers();

    expect(client.requests[0]?.url).toBe(`${BASE_URL}/reports/local-tax-numbers`);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBeInstanceOf(LocalTaxNumberRow);
    expect(rows[0]?.companyName).toBe('Eni S.p.A., Roma');
    expect(rows[0]?.requestedName).toBeNull();
    expect(rows[0]?.taxNumber).toBe('00905811006');
    expect(rows[0]?.taxNumberName).toBe('Partita IVA');
    expect(rows[0]?.taxNumberSource).toBe('vat_id');
    expect(rows[0]?.source).toBe('vat_check');
    expect(rows[0]?.checkId).toBe('uuid-1');
    expect(rows[1]?.companyName).toBe('Fritz "Schiller" OHG');
    expect(rows[1]?.taxNumber).toBe('21815953301');
    expect(rows[1]?.taxNumberSource).toBe('company_website');
    expect(rows[1]?.vatNumber).toBeNull();
    expect(rows[2]?.taxNumber).toBeNull();
    expect(rows[2]?.toArray()).toMatchObject({ vatStatus: 'not_found', taxNumberSource: null });
  });

  it('parses an empty report', () => {
    expect(
      parseLocalTaxNumbersCsv(
        '\uFEFFcompanyName,requestedName,country,vatNumber,vatStatus,taxNumber,taxNumberName,taxNumberSource,source,checkedAt,checkId\n',
      ),
    ).toEqual([]);
    expect(parseLocalTaxNumbersCsv('')).toEqual([]);
  });

  it('returns the summary counts', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ companies: 120, withTaxNumber: 87 })]);

    const summary = await endpoint.localTaxNumbersSummary({ dateFrom: '2026-10-01', countries: ['PL'] });

    expect(summary).toEqual({ companies: 120, withTaxNumber: 87 });
    expect(client.requests[0]?.url).toBe(
      `${BASE_URL}/reports/local-tax-numbers/summary?date_from=2026-10-01&countries%5B%5D=PL`,
    );
  });

  it('turns an invalid filter into a ValidationException', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        {
          message: 'The date to field must be a date after or equal to date from.',
          errors: { date_to: ['The date to field must be a date after or equal to date from.'] },
        },
        422,
      ),
    ]);

    await expect(endpoint.localTaxNumbersCsv({ dateFrom: '2026-10-23', dateTo: '2026-10-01' })).rejects.toBeInstanceOf(
      ValidationException,
    );
  });
});

describe('VatEndpoint.registerFacts', () => {
  const UUID = '5f0c6a3e-1111-4c4c-9d9d-000000000001';

  it('reads only the cache by default', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: {
          country: 'FR',
          register: 'bodacc',
          available: true,
          siren: '123456789',
          status: 'not_checked',
          checkedAt: null,
          retryAfter: null,
          canRetry: true,
          note: null,
          announcements: [],
        },
      }),
    ]);

    const facts = await endpoint.registerFacts(UUID);

    expect(facts).toBeInstanceOf(VatRegisterFacts);
    expect(facts.status).toBe(RegisterFactsStatus.NOT_CHECKED);
    expect(facts.found()).toBe(false);
    expect(facts.available).toBe(true);
    expect(facts.canRetry).toBe(true);
    expect(facts.register).toBe('bodacc');
    expect(facts.siren).toBe('123456789');
    expect(facts.note).toBeUndefined();
    expect(client.requests[0]?.method).toBe('GET');
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history/${UUID}/register-facts`);
  });

  it('fetches and returns the note and the timeline', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: {
          country: 'FR',
          register: 'bodacc',
          available: true,
          siren: '123456789',
          status: 'found',
          checkedAt: '2026-11-12T10:00:00+00:00',
          retryAfter: '2026-11-19T10:00:00+00:00',
          canRetry: false,
          note: {
            event: 'struck_off_merger',
            meaning: 'vat_ceased_vies_lag',
            action: 'use_successor_vat',
            warning: null,
            severity: 'error',
            params: { date: '2026-06-30', related: ['ABSORBANTE SA'], successorVat: 'FR83987654321' },
            source: {
              register: 'bodacc',
              id: 'A202601234567',
              date: '2026-07-04',
              url: 'https://www.bodacc.fr/annonce/detail/A202601234567',
            },
            text: { en: 'Struck off after a merger.', de: 'Nach einer Fusion gelöscht.' },
          },
          announcements: [
            {
              id: 'A202601234567',
              date: '2026-07-04',
              kind: 'struck_off',
              severity: 'error',
              url: 'https://www.bodacc.fr/annonce/detail/A202601234567',
            },
            'not-an-announcement',
          ],
        },
      }),
    ]);

    const facts = await endpoint.registerFacts(UUID, { fetch: true });

    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history/${UUID}/register-facts?fetch=1`);
    expect(facts.found()).toBe(true);
    expect(facts.retryAfter).toBe('2026-11-19T10:00:00+00:00');
    expect(facts.canRetry).toBe(false);
    expect(facts.note?.event).toBe('struck_off_merger');
    expect(facts.note?.severity).toBe('error');
    expect(facts.note?.params.successorVat).toBe('FR83987654321');
    expect(registerNoteText(facts.note!, Language.GERMAN)).toBe('Nach einer Fusion gelöscht.');
    expect(facts.announcements).toEqual([
      {
        id: 'A202601234567',
        date: '2026-07-04',
        kind: 'struck_off',
        severity: 'error',
        url: 'https://www.bodacc.fr/annonce/detail/A202601234567',
      },
    ]);
    expect(facts.toArray()['status']).toBe('found');
  });

  it('refresh also fetches', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: { country: 'ES', register: 'borme', available: true, status: 'error', canRetry: true },
      }),
    ]);

    const facts = await endpoint.registerFacts(UUID, { refresh: true });

    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history/${UUID}/register-facts?fetch=1&refresh=1`);
    expect(facts.status).toBe(RegisterFactsStatus.ERROR);
    expect(facts.canRetry).toBe(true);
  });

  it('maps an unavailable country and an unknown status', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: { country: 'DE', register: null, available: false, status: 'unavailable', note: null, announcements: [] },
      }),
      SequenceHttpClient.jsonResponse({ success: true, data: { status: 'something_new' } }),
    ]);

    const unavailable = await endpoint.registerFacts(UUID);
    expect(unavailable.status).toBe(RegisterFactsStatus.UNAVAILABLE);
    expect(unavailable.available).toBe(false);
    expect(unavailable.register).toBeUndefined();

    expect((await endpoint.registerFacts(UUID)).status).toBe(RegisterFactsStatus.UNKNOWN);
  });

  it('throws HttpException for an unknown check and does not retry it', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: false, message: 'VAT history entry not found.' }, 404),
    ]);

    const error = await endpoint.registerFacts('missing').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).statusCode).toBe(404);
    expect(client.requests).toHaveLength(1);
  });

  it('refuses an empty uuid before the request', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.registerFacts('  ')).rejects.toThrow(TaxoraException);
    expect(client.requests).toHaveLength(0);
  });
});

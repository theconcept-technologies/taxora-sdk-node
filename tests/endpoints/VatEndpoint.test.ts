import { describe, it, expect } from 'vitest';
import { VatEndpoint } from '../../src/endpoints/VatEndpoint.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { VatResource } from '../../src/dto/VatResource.js';
import { VatCollection } from '../../src/dto/VatCollection.js';
import { VatCertificateExport } from '../../src/dto/VatCertificateExport.js';
import { VatValidationAddressInput } from '../../src/dto/VatValidationAddressInput.js';
import { Language } from '../../src/enums/Language.js';
import { HttpException } from '../../src/exceptions/HttpException.js';
import { ValidationException } from '../../src/exceptions/ValidationException.js';
import { RetryPolicy } from '../../src/http/RetryPolicy.js';

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
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Too Many Requests' }, 429),
    ]);

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
  it('GET /vat/state/{uid} returns VatResource', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    const result = await endpoint.state('ATU12345678');
    expect(result).toBeInstanceOf(VatResource);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/state/ATU12345678`);
    expect(client.requests[0]?.method).toBe('GET');
  });
});

describe('VatEndpoint.history', () => {
  it('GET /vat/history returns VatCollection', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    const result = await endpoint.history();
    expect(result).toBeInstanceOf(VatCollection);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history`);
  });

  it('GET /vat/history with vatUid filter', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    await endpoint.history('ATU12345678');
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history?vat_uid=ATU12345678`);
  });
});

describe('VatEndpoint.search', () => {
  it('GET /vat/search returns VatCollection', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    const result = await endpoint.search('Alpha');
    expect(result).toBeInstanceOf(VatCollection);
    expect(client.requests[0]?.url).toContain('/vat/search');
    expect(client.requests[0]?.url).toContain('term=Alpha');
  });

  it('includes perPage parameter', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: [] })]);

    await endpoint.search('Alpha', 25);
    expect(client.requests[0]?.url).toContain('per_page=25');
  });
});

describe('VatEndpoint.certificate', () => {
  it('GET /vat/certificate/{uuid} returns binary', async () => {
    const pdfData = new Uint8Array([1, 2, 3, 4]);
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.binaryResponse(pdfData)]);

    const result = await endpoint.certificate('uuid-123');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/certificate/uuid-123`);
  });

  it('includes lang parameter when provided', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.binaryResponse(new Uint8Array())]);

    await endpoint.certificate('uuid-123', Language.GERMAN);
    expect(client.requests[0]?.url).toContain('lang=de');
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
  it('GET /vat/certificates/bulk-export/{id}/download returns binary', async () => {
    const zipData = new Uint8Array([5, 6, 7, 8]);
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.binaryResponse(zipData)]);

    const result = await endpoint.downloadBulkExport('exp-123');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/certificates/bulk-export/exp-123/download`);
  });
});

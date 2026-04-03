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

const BASE_URL = 'https://sandbox.taxora.io/v1';
const API_KEY = 'test-api-key';

const VAT_RESPONSE = {
  success: true,
  data: {
    uuid: 'uuid-123',
    vat_uid: 'ATU12345678',
    state: 'valid',
    company_name: 'Alpha Handels GmbH',
    environment: 'SANDBOX',
  },
};

function makeEndpoint(responses: Response[]) {
  const storage = new InMemoryTokenStorage();
  const token = new Token('test-token', 'Bearer', new Date(Date.now() + 3600_000));
  storage.set(token);
  const client = new SequenceHttpClient(responses);
  const endpoint = new VatEndpoint(BASE_URL, API_KEY, storage, client);
  return { endpoint, storage, client };
}

describe('VatEndpoint.validate', () => {
  it('sends POST to /vat/validate and returns VatResource', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(VAT_RESPONSE)]);

    const result = await endpoint.validate('ATU12345678');

    expect(result).toBeInstanceOf(VatResource);
    expect(result.vatUid).toBe('ATU12345678');

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

  it('retries once on 504 and returns VatResource on success', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Gateway Timeout' }, 504),
      SequenceHttpClient.jsonResponse(VAT_RESPONSE),
    ]);

    const result = await endpoint.validate('ATU12345678');
    expect(result).toBeInstanceOf(VatResource);
    expect(client.requests).toHaveLength(2);
  });

  it('throws HttpException with clean message after second 504', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Gateway Timeout' }, 504),
      SequenceHttpClient.jsonResponse({ message: 'Gateway Timeout' }, 504),
    ]);

    await expect(endpoint.validate('ATU12345678')).rejects.toThrow(HttpException);
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
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: { valid: true } }),
    ]);

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
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: [] }),
    ]);

    const result = await endpoint.history();
    expect(result).toBeInstanceOf(VatCollection);
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history`);
  });

  it('GET /vat/history with vatUid filter', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: [] }),
    ]);

    await endpoint.history('ATU12345678');
    expect(client.requests[0]?.url).toBe(`${BASE_URL}/vat/history?vat_uid=ATU12345678`);
  });
});

describe('VatEndpoint.search', () => {
  it('GET /vat/search returns VatCollection', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: [] }),
    ]);

    const result = await endpoint.search('Alpha');
    expect(result).toBeInstanceOf(VatCollection);
    expect(client.requests[0]?.url).toContain('/vat/search');
    expect(client.requests[0]?.url).toContain('term=Alpha');
  });

  it('includes perPage parameter', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: [] }),
    ]);

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
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.binaryResponse(new Uint8Array()),
    ]);

    await endpoint.certificate('uuid-123', Language.GERMAN);
    expect(client.requests[0]?.url).toContain('lang=de');
  });
});

describe('VatEndpoint.certificatesBulkExport', () => {
  it('POST with Date objects formatted as YYYY-MM-DD', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: { export_id: 'exp-1' } }, 202),
    ]);

    const result = await endpoint.certificatesBulkExport(
      new Date('2024-01-01'),
      new Date('2024-12-31'),
    );

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

    await expect(
      endpoint.certificatesBulkExport('01/01/2024', '2024-12-31'),
    ).rejects.toThrow();
  });

  it('throws when export_id is missing from response', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: {} }, 202),
    ]);

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
    expect(client.requests[0]?.url).toBe(
      `${BASE_URL}/vat/certificates/bulk-export/exp-123/download`,
    );
  });
});

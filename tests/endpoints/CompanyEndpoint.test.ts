import { describe, it, expect } from 'vitest';
import { CompanyEndpoint } from '../../src/endpoints/CompanyEndpoint.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { HttpException } from '../../src/exceptions/HttpException.js';

const BASE_URL = 'https://sandbox.taxora.io/v1';
const API_KEY = 'test-api-key';

function makeEndpoint(responses: Response[]) {
  const storage = new InMemoryTokenStorage();
  const token = new Token('test-token', 'Bearer', new Date(Date.now() + 3600_000));
  storage.set(token);
  const client = new SequenceHttpClient(responses);
  const endpoint = new CompanyEndpoint(BASE_URL, API_KEY, storage, client);
  return { endpoint, storage, client };
}

describe('CompanyEndpoint.get', () => {
  it('returns company payload with correct headers', async () => {
    const companyData = { id: 1, name: 'Test Company', vat_id: 'ATU12345678' };
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ success: true, data: companyData })]);

    const result = await endpoint.get();

    expect(result).toEqual(companyData);

    const req = client.requests[0]!;
    expect(req.method).toBe('GET');
    expect(req.url).toBe(`${BASE_URL}/company`);

    const headers = req.options?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(API_KEY);
    expect(headers['Authorization']).toBe('Bearer test-token');
  });

  it('returns raw payload when no data wrapper', async () => {
    const companyData = { id: 2, name: 'Another Company' };
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse(companyData)]);

    const result = await endpoint.get();
    expect(result).toEqual(companyData);
  });

  it('throws HttpException on 500', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ message: 'Internal Server Error' }, 500)]);

    await expect(endpoint.get()).rejects.toThrow(HttpException);
  });
});

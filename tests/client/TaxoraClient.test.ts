import { describe, it, expect } from 'vitest';
import { TaxoraClient } from '../../src/client/TaxoraClient.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { Environment } from '../../src/enums/Environment.js';
import { AuthEndpoint } from '../../src/endpoints/AuthEndpoint.js';
import { VatEndpoint } from '../../src/endpoints/VatEndpoint.js';
import { CompanyEndpoint } from '../../src/endpoints/CompanyEndpoint.js';
import { AuthenticationException } from '../../src/exceptions/AuthenticationException.js';

const TOKEN_RESPONSE = {
  success: true,
  data: {
    access_token: 'refreshed-token',
    token_type: 'Bearer',
    expires_in: 3600,
  },
};

const COMPANY_RESPONSE = {
  success: true,
  data: { id: 1, name: 'Test Company', api_rate_limit: 120, vat_rate_limit: 80 },
};

function makeClient(responses: Response[], environment = Environment.SANDBOX) {
  const storage = new InMemoryTokenStorage();
  const client = new SequenceHttpClient(responses);
  const taxoraClient = new TaxoraClient({
    apiKey: 'test-api-key',
    environment,
    tokenStorage: storage,
    httpClient: client,
  });
  return { taxoraClient, storage, client };
}

describe('TaxoraClient', () => {
  it('exposes auth, vat, and company endpoints', () => {
    const { taxoraClient } = makeClient([]);
    expect(taxoraClient.auth).toBeInstanceOf(AuthEndpoint);
    expect(taxoraClient.vat).toBeInstanceOf(VatEndpoint);
    expect(taxoraClient.company).toBeInstanceOf(CompanyEndpoint);
  });

  it('uses SANDBOX base URL for sandbox environment', () => {
    const { taxoraClient } = makeClient([], Environment.SANDBOX);
    expect(taxoraClient.baseUrl).toBe('https://sandbox.taxora.io/v1');
  });

  it('uses PRODUCTION base URL for production environment', () => {
    const { taxoraClient } = makeClient([], Environment.PRODUCTION);
    expect(taxoraClient.baseUrl).toBe('https://api.taxora.io/v1');
  });

  it('preemptively refreshes expired token before making request', async () => {
    const expiredToken = new Token('expired-token', 'Bearer', new Date(Date.now() - 1000));
    const { taxoraClient, storage, client } = makeClient([
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE), // refresh
      SequenceHttpClient.jsonResponse(COMPANY_RESPONSE), // company get
    ]);
    storage.set(expiredToken);

    await taxoraClient.company.get();

    // refresh was called first
    expect(client.requests[0]?.url).toContain('/auth/refresh');
    // then company was called with the new token
    const companyHeaders = client.requests[1]?.options?.headers as Record<string, string>;
    expect(companyHeaders['Authorization']).toBe('Bearer refreshed-token');
  });

  it('handles 401 by refreshing and retrying once', async () => {
    const validToken = new Token('valid-token', 'Bearer', new Date(Date.now() + 3600_000));
    const { taxoraClient, storage, client } = makeClient([
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401), // first attempt → 401
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE), // refresh
      SequenceHttpClient.jsonResponse(COMPANY_RESPONSE), // retry
    ]);
    storage.set(validToken);

    const result = await taxoraClient.company.get();
    expect(result).toEqual({ id: 1, name: 'Test Company', api_rate_limit: 120, vat_rate_limit: 80 });
    expect(client.requests).toHaveLength(3);
    expect(client.requests[1]?.url).toContain('/auth/refresh');
  });

  it('normalizes legacy company rate_limit through the public client', async () => {
    const validToken = new Token('valid-token', 'Bearer', new Date(Date.now() + 3600_000));
    const { taxoraClient, storage } = makeClient([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: { id: 2, name: 'Legacy Company', rate_limit: 100 },
      }),
    ]);
    storage.set(validToken);

    const result = await taxoraClient.company.get();
    expect(result).toEqual({
      id: 2,
      name: 'Legacy Company',
      rate_limit: 100,
      api_rate_limit: 100,
      vat_rate_limit: 100,
    });
  });

  it('bubbles AuthenticationException when refresh fails after 401', async () => {
    const validToken = new Token('valid-token', 'Bearer', new Date(Date.now() + 3600_000));
    const { taxoraClient, storage } = makeClient([
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401), // first attempt → 401
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401), // refresh fails
    ]);
    storage.set(validToken);

    await expect(taxoraClient.company.get()).rejects.toThrow(AuthenticationException);
  });
});

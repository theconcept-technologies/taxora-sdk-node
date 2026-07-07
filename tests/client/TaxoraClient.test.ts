import { describe, it, expect } from 'vitest';
import { TaxoraClient } from '../../src/client/TaxoraClient.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { Environment } from '../../src/enums/Environment.js';
import { AuthEndpoint } from '../../src/endpoints/AuthEndpoint.js';
import { VatEndpoint } from '../../src/endpoints/VatEndpoint.js';
import { CompanyEndpoint } from '../../src/endpoints/CompanyEndpoint.js';
import { EReportingEndpoint } from '../../src/endpoints/EReportingEndpoint.js';
import { SmartEnrichmentEndpoint } from '../../src/endpoints/SmartEnrichmentEndpoint.js';
import { AuthenticationException } from '../../src/exceptions/AuthenticationException.js';
import { SDK_VERSION } from '../../src/version.js';

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
  it('exposes auth, vat, company, smartEnrichment and eReporting endpoints', () => {
    const { taxoraClient } = makeClient([]);
    expect(taxoraClient.auth).toBeInstanceOf(AuthEndpoint);
    expect(taxoraClient.vat).toBeInstanceOf(VatEndpoint);
    expect(taxoraClient.company).toBeInstanceOf(CompanyEndpoint);
    expect(taxoraClient.smartEnrichment).toBeInstanceOf(SmartEnrichmentEndpoint);
    expect(taxoraClient.eReporting).toBeInstanceOf(EReportingEndpoint);
  });

  it('wires smartEnrichment through the 401-refreshing client', async () => {
    const validToken = new Token('valid-token', 'Bearer', new Date(Date.now() + 3600_000));
    const { taxoraClient, storage, client } = makeClient([
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401), // first attempt → 401
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE), // refresh
      SequenceHttpClient.jsonResponse({ jobId: 'job-1', status: 'found' }), // retry
    ]);
    storage.set(validToken);

    const job = await taxoraClient.smartEnrichment.get('job-1');

    expect(job.jobId).toBe('job-1');
    expect(client.requests).toHaveLength(3);
    expect(client.requests[1]?.url).toContain('/auth/refresh');
    const retryHeaders = client.requests[2]?.options?.headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer refreshed-token');
  });

  it('wires eReporting through the 401-refreshing client', async () => {
    const validToken = new Token('valid-token', 'Bearer', new Date(Date.now() + 3600_000));
    const { taxoraClient, storage, client } = makeClient([
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401), // first attempt → 401
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE), // refresh
      SequenceHttpClient.jsonResponse({ success: true, data: { data: [], meta: {} } }), // retry
    ]);
    storage.set(validToken);

    const page = await taxoraClient.eReporting.listEnrollments();

    expect(page.length).toBe(0);
    expect(client.requests).toHaveLength(3);
    expect(client.requests[0]?.url).toContain('/compliance/enrollments');
    expect(client.requests[1]?.url).toContain('/auth/refresh');
    const retryHeaders = client.requests[2]?.options?.headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer refreshed-token');
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

  it('stamps the SDK version header on auth requests', async () => {
    const { taxoraClient, client } = makeClient([SequenceHttpClient.jsonResponse(TOKEN_RESPONSE)]);

    await taxoraClient.auth.login('user@example.com', 'secret', 'unit-test-device');

    const headers = client.requests[0]?.options?.headers as Record<string, string>;
    expect(headers['X-Taxora-SDK-Version']).toBe(`taxora-node/${SDK_VERSION}`);
  });

  it('stamps the SDK version header on non-auth requests', async () => {
    const validToken = new Token('valid-token', 'Bearer', new Date(Date.now() + 3600_000));
    const { taxoraClient, storage, client } = makeClient([SequenceHttpClient.jsonResponse(COMPANY_RESPONSE)]);
    storage.set(validToken);

    await taxoraClient.company.get();

    const headers = client.requests[0]?.options?.headers as Record<string, string>;
    expect(headers['X-Taxora-SDK-Version']).toBe(`taxora-node/${SDK_VERSION}`);
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

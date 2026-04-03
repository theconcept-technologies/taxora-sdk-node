import { describe, it, expect } from 'vitest';
import { TaxoraClientFactory } from '../../src/client/TaxoraClientFactory.js';
import { TaxoraClient } from '../../src/client/TaxoraClient.js';
import { Environment } from '../../src/enums/Environment.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { FetchHttpClient } from '../../src/http/FetchHttpClient.js';

describe('TaxoraClientFactory', () => {
  it('creates a TaxoraClient instance', () => {
    const client = TaxoraClientFactory.create({ apiKey: 'test-key' });
    expect(client).toBeInstanceOf(TaxoraClient);
  });

  it('defaults to sandbox environment', () => {
    const client = TaxoraClientFactory.create({ apiKey: 'test-key' });
    expect(client.baseUrl).toBe('https://sandbox.taxora.io/v1');
  });

  it('accepts PRODUCTION environment', () => {
    const client = TaxoraClientFactory.create({
      apiKey: 'test-key',
      environment: Environment.PRODUCTION,
    });
    expect(client.baseUrl).toBe('https://api.taxora.io/v1');
  });

  it('accepts custom tokenStorage', () => {
    const storage = new InMemoryTokenStorage();
    const client = TaxoraClientFactory.create({
      apiKey: 'test-key',
      tokenStorage: storage,
    });
    expect(client).toBeInstanceOf(TaxoraClient);
  });

  it('accepts custom httpClient', () => {
    const httpClient = new FetchHttpClient();
    const client = TaxoraClientFactory.create({
      apiKey: 'test-key',
      httpClient,
    });
    expect(client).toBeInstanceOf(TaxoraClient);
  });
});

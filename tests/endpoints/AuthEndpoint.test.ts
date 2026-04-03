import { describe, it, expect } from 'vitest';
import { AuthEndpoint } from '../../src/endpoints/AuthEndpoint.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { LoginIdentifier } from '../../src/enums/LoginIdentifier.js';
import { AuthenticationException } from '../../src/exceptions/AuthenticationException.js';
import { HttpException } from '../../src/exceptions/HttpException.js';

const BASE_URL = 'https://sandbox.taxora.io/v1';
const API_KEY = 'test-api-key';

const TOKEN_RESPONSE = {
  success: true,
  data: {
    access_token: 'my-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
  },
};

function makeEndpoint(responses: Response[]): { endpoint: AuthEndpoint; storage: InMemoryTokenStorage; client: SequenceHttpClient } {
  const storage = new InMemoryTokenStorage();
  const client = new SequenceHttpClient(responses);
  const endpoint = new AuthEndpoint(BASE_URL, API_KEY, storage, client);
  return { endpoint, storage, client };
}

describe('AuthEndpoint.login', () => {
  it('sends login request with email identifier and stores token', async () => {
    const { endpoint, storage, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE),
    ]);

    const token = await endpoint.login('user@example.com', 'secret123');

    expect(token.accessToken).toBe('my-access-token');
    expect(storage.get()).toBe(token);

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/auth/login`);

    const body = JSON.parse(req.options?.body as string);
    expect(body.email).toBe('user@example.com');
    expect(body.password).toBe('secret123');
    expect(body.identifier).toBe(LoginIdentifier.EMAIL);
    expect(body.device_name).toBeDefined();
  });

  it('sends x-api-key header', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(TOKEN_RESPONSE)]);

    await endpoint.login('user@example.com', 'secret');

    const headers = client.requests[0]?.options?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(API_KEY);
  });

  it('supports CLIENT_ID identifier', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(TOKEN_RESPONSE)]);

    await endpoint.login('my-client-id', 'secret', undefined, LoginIdentifier.CLIENT_ID);

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.client_id).toBe('my-client-id');
    expect(body.identifier).toBe(LoginIdentifier.CLIENT_ID);
  });

  it('loginWithClientId is a shorthand for CLIENT_ID login', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(TOKEN_RESPONSE)]);

    await endpoint.loginWithClientId('my-client-id', 'secret');

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.client_id).toBe('my-client-id');
    expect(body.identifier).toBe(LoginIdentifier.CLIENT_ID);
  });

  it('uses provided device name', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(TOKEN_RESPONSE)]);

    await endpoint.login('user@example.com', 'secret', 'my-device');

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(body.device_name).toBe('my-device');
  });

  it('auto-generates device name when not provided', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(TOKEN_RESPONSE)]);

    await endpoint.login('user@example.com', 'secret');

    const body = JSON.parse(client.requests[0]?.options?.body as string);
    expect(typeof body.device_name).toBe('string');
    expect(body.device_name.length).toBeGreaterThan(0);
  });

  it('strips Bearer prefix from access_token', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: { access_token: 'Bearer stripped-token', token_type: 'Bearer', expires_in: 3600 },
      }),
    ]);

    const token = await endpoint.login('user@example.com', 'secret');
    expect(token.accessToken).toBe('stripped-token');
  });

  it('throws AuthenticationException on 401', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401),
    ]);

    await expect(endpoint.login('bad@example.com', 'wrong')).rejects.toThrow(AuthenticationException);
  });

  it('throws HttpException on 500', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ message: 'Internal Server Error' }, 500),
    ]);

    await expect(endpoint.login('user@example.com', 'secret')).rejects.toThrow(HttpException);
  });
});

describe('AuthEndpoint.refresh', () => {
  it('sends refresh request with bearer token and updates storage', async () => {
    const { endpoint, storage, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE),
      SequenceHttpClient.jsonResponse({
        success: true,
        data: { access_token: 'refreshed-token', token_type: 'Bearer', expires_in: 3600 },
      }),
    ]);

    await endpoint.login('user@example.com', 'secret');
    const refreshed = await endpoint.refresh();

    expect(refreshed.accessToken).toBe('refreshed-token');
    expect(storage.get()).toBe(refreshed);

    const refreshReq = client.requests[1]!;
    expect(refreshReq.url).toBe(`${BASE_URL}/auth/refresh`);
    const headers = refreshReq.options?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-access-token');
  });

  it('throws AuthenticationException on 401 during refresh', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE),
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401),
    ]);

    await endpoint.login('user@example.com', 'secret');
    await expect(endpoint.refresh()).rejects.toThrow(AuthenticationException);
  });

  it('throws HttpException on 500 during refresh', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(TOKEN_RESPONSE),
      SequenceHttpClient.jsonResponse({ message: 'Server Error' }, 500),
    ]);

    await endpoint.login('user@example.com', 'secret');
    await expect(endpoint.refresh()).rejects.toThrow(HttpException);
  });
});

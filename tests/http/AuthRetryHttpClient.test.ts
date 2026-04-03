import { describe, it, expect, vi } from 'vitest';
import { AuthRetryHttpClient } from '../../src/http/AuthRetryHttpClient.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { AuthenticationException } from '../../src/exceptions/AuthenticationException.js';

function makeToken(expiresInMs: number): Token {
  return new Token('access-token', 'Bearer', new Date(Date.now() + expiresInMs));
}

const REFRESH_TOKEN = new Token('refreshed-token', 'Bearer', new Date(Date.now() + 3600_000));

describe('AuthRetryHttpClient', () => {
  it('passes auth routes through without modification', async () => {
    const storage = new InMemoryTokenStorage();
    const inner = new SequenceHttpClient([SequenceHttpClient.jsonResponse({ ok: true })]);
    const refreshFn = vi.fn().mockResolvedValue(REFRESH_TOKEN);
    const client = new AuthRetryHttpClient(inner, storage, refreshFn);

    await client.request('POST', 'https://sandbox.taxora.io/v1/auth/login', {});

    expect(refreshFn).not.toHaveBeenCalled();
    expect(inner.requests).toHaveLength(1);
  });

  it('does not refresh when token is valid', async () => {
    const storage = new InMemoryTokenStorage();
    storage.set(makeToken(3600_000));
    const inner = new SequenceHttpClient([SequenceHttpClient.jsonResponse({ data: {} })]);
    const refreshFn = vi.fn().mockResolvedValue(REFRESH_TOKEN);
    const client = new AuthRetryHttpClient(inner, storage, refreshFn);

    await client.request('GET', 'https://sandbox.taxora.io/v1/company', {});

    expect(refreshFn).not.toHaveBeenCalled();
  });

  it('preemptively refreshes expired token', async () => {
    const storage = new InMemoryTokenStorage();
    storage.set(makeToken(-1000));
    const inner = new SequenceHttpClient([SequenceHttpClient.jsonResponse({ data: {} })]);
    const refreshFn = vi.fn().mockImplementation(async () => {
      storage.set(REFRESH_TOKEN);
      return REFRESH_TOKEN;
    });
    const client = new AuthRetryHttpClient(inner, storage, refreshFn);

    await client.request('GET', 'https://sandbox.taxora.io/v1/company', {});

    expect(refreshFn).toHaveBeenCalledOnce();
  });

  it('works with no token in storage (no preemptive refresh, no auth header)', async () => {
    const storage = new InMemoryTokenStorage();
    const inner = new SequenceHttpClient([SequenceHttpClient.jsonResponse({ data: {} })]);
    const refreshFn = vi.fn();
    const client = new AuthRetryHttpClient(inner, storage, refreshFn);

    await client.request('GET', 'https://sandbox.taxora.io/v1/company');

    expect(refreshFn).not.toHaveBeenCalled();
    const headers = inner.requests[0]?.options?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('injects Authorization header for non-auth routes', async () => {
    const storage = new InMemoryTokenStorage();
    storage.set(makeToken(3600_000));
    const inner = new SequenceHttpClient([SequenceHttpClient.jsonResponse({ data: {} })]);
    const refreshFn = vi.fn();
    const client = new AuthRetryHttpClient(inner, storage, refreshFn);

    await client.request('GET', 'https://sandbox.taxora.io/v1/company', {
      headers: { 'x-api-key': 'my-key' },
    });

    const headers = inner.requests[0]?.options?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer access-token');
    expect(headers['x-api-key']).toBe('my-key');
  });

  it('refreshes and retries on 401 response', async () => {
    const storage = new InMemoryTokenStorage();
    storage.set(makeToken(3600_000));
    const inner = new SequenceHttpClient([
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401),
      SequenceHttpClient.jsonResponse({ data: { id: 1 } }, 200),
    ]);
    const refreshFn = vi.fn().mockImplementation(async () => {
      storage.set(REFRESH_TOKEN);
      return REFRESH_TOKEN;
    });
    const client = new AuthRetryHttpClient(inner, storage, refreshFn);

    const response = await client.request('GET', 'https://sandbox.taxora.io/v1/company', {});

    expect(response.status).toBe(200);
    expect(refreshFn).toHaveBeenCalledOnce();
    expect(inner.requests).toHaveLength(2);
  });

  it('throws AuthenticationException when retry also returns 401', async () => {
    const storage = new InMemoryTokenStorage();
    storage.set(makeToken(3600_000));
    const inner = new SequenceHttpClient([
      SequenceHttpClient.jsonResponse({ message: 'Unauthorized' }, 401),
      SequenceHttpClient.jsonResponse({ message: 'Still Unauthorized' }, 401),
    ]);
    const refreshFn = vi.fn().mockResolvedValue(REFRESH_TOKEN);
    const client = new AuthRetryHttpClient(inner, storage, refreshFn);

    await expect(client.request('GET', 'https://sandbox.taxora.io/v1/company', {})).rejects.toThrow(
      AuthenticationException,
    );
  });
});

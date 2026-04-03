import { describe, it, expect, vi } from 'vitest';
import { FetchHttpClient } from '../../src/http/FetchHttpClient.js';

describe('FetchHttpClient', () => {
  it('calls fetch with method and url', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FetchHttpClient();
    const response = await client.request('GET', 'https://example.com/test');

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/test', { method: 'GET' });
    expect(response.status).toBe(200);

    vi.unstubAllGlobals();
  });

  it('passes options to fetch', async () => {
    const mockResponse = new Response('{}', { status: 201 });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const client = new FetchHttpClient();
    await client.request('POST', 'https://example.com/test', {
      body: JSON.stringify({ foo: 'bar' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      }),
    );

    vi.unstubAllGlobals();
  });
});

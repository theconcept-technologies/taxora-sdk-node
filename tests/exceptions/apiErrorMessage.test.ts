import { describe, it, expect } from 'vitest';
import { describeApiError, jsonErrorMessage, statusErrorMessage } from '../../src/exceptions/apiErrorMessage.js';

describe('describeApiError', () => {
  it('uses the JSON message verbatim', () => {
    expect(describeApiError('{"success":false,"message":"VAT number is unknown."}', 400)).toBe('VAT number is unknown.');
  });

  it('uses the JSON error key', () => {
    expect(describeApiError('{"error":"rate limit reached"}', 429)).toBe('rate limit reached');
  });

  it('uses the first validation error', () => {
    expect(describeApiError('{"errors":{"vat_uid":["The vat uid field is required."]}}', 400)).toBe(
      'vat_uid: The vat uid field is required.',
    );
  });

  it('falls back to the status line for an HTML gateway page', () => {
    const html = '  <!DOCTYPE html>\n<html><body><p>Error code: 504</p></body></html>\n';
    expect(describeApiError(html, 504)).toBe('Taxora API request failed (HTTP 504 Gateway Timeout).');
  });

  it('rejects HTML hidden inside a JSON message', () => {
    const body = JSON.stringify({ message: '<!DOCTYPE html><html><body>nope</body></html>' });
    expect(describeApiError(body, 500)).toBe('Taxora API request failed (HTTP 500 Internal Server Error).');
  });

  it('falls back to the status line for empty bodies', () => {
    expect(describeApiError('', 503)).toBe('Taxora API request failed (HTTP 503 Service Unavailable).');
    expect(describeApiError(null, 418)).toBe('Taxora API request failed (HTTP 418).');
  });

  it('keeps a short plain text body', () => {
    expect(describeApiError('upstream request timeout', 504)).toBe('upstream request timeout');
  });

  it('drops a long plain text body', () => {
    expect(describeApiError('a'.repeat(201), 500)).toBe('Taxora API request failed (HTTP 500 Internal Server Error).');
  });

  it('collapses and truncates long JSON messages', () => {
    const message = describeApiError(JSON.stringify({ message: `line one\n\nline ${'x'.repeat(600)}` }), 400);
    expect(message.startsWith('line one line xxx')).toBe(true);
    expect(message.endsWith('…')).toBe(true);
    expect(message).toHaveLength(500);
  });
});

describe('jsonErrorMessage', () => {
  it('returns null for non-JSON bodies', () => {
    expect(jsonErrorMessage('<html></html>')).toBeNull();
    expect(jsonErrorMessage('')).toBeNull();
    expect(jsonErrorMessage(undefined)).toBeNull();
  });
});

describe('statusErrorMessage', () => {
  it('names the known reason phrases', () => {
    expect(statusErrorMessage(502)).toBe('Taxora API request failed (HTTP 502 Bad Gateway).');
  });
});

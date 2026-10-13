import { describe, it, expect } from 'vitest';
import {
  verifyWebhookSignature,
  constructWebhookEvent,
  parseWebhookSignatureHeader,
  computeWebhookSignature,
  generateWebhookSignatureHeader,
  WebhookSignatureVerificationError,
  type TaxoraWebhookEvent,
} from '../../src/index.js';

const SECRET = 'whsec_test';
const NOW = 1700000000;
const BODY = '{"id":"evt_1"}';

function reasonOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof WebhookSignatureVerificationError) return e.reason;
    throw e;
  }
  return undefined;
}

describe('computeWebhookSignature', () => {
  it('matches the backend test vector (HMAC-SHA256 over "t.body")', () => {
    // Same vector as taxora-backend tests/Unit/Services/Webhook/WebhookSignatureServiceTest.
    expect(computeWebhookSignature(BODY, NOW, SECRET)).toBe(
      'c89214b5b5da833daed6f0b8c5bb6bd58cea9022bd80ccc78230f3942d632925',
    );
  });

  it('gives the same result for string, Buffer, Uint8Array and ArrayBuffer bodies', () => {
    const expected = computeWebhookSignature(BODY, NOW, SECRET);
    const buf = Buffer.from(BODY);
    expect(computeWebhookSignature(buf, NOW, SECRET)).toBe(expected);
    expect(computeWebhookSignature(new Uint8Array(buf), NOW, SECRET)).toBe(expected);
    expect(computeWebhookSignature(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length), NOW, SECRET)).toBe(
      expected,
    );
  });
});

describe('parseWebhookSignatureHeader', () => {
  it('reads t and every v1, ignoring unknown schemes', () => {
    const a = 'a'.repeat(64);
    const b = 'B'.repeat(64);
    expect(parseWebhookSignatureHeader(`t=${NOW},v1=${a},v0=zzz,v1=${b}`)).toEqual({
      timestamp: NOW,
      signatures: [a, b.toLowerCase()],
    });
  });

  it('accepts the array form Node uses for repeated headers', () => {
    const header = generateWebhookSignatureHeader(BODY, SECRET, NOW);
    expect(parseWebhookSignatureHeader([header]).timestamp).toBe(NOW);
  });

  it('rejects missing and malformed headers', () => {
    expect(reasonOf(() => parseWebhookSignatureHeader(undefined))).toBe('missing_header');
    expect(reasonOf(() => parseWebhookSignatureHeader(''))).toBe('missing_header');
    expect(reasonOf(() => parseWebhookSignatureHeader('sha256=abc'))).toBe('malformed_header');
    expect(reasonOf(() => parseWebhookSignatureHeader(`t=${NOW}`))).toBe('malformed_header');
    expect(reasonOf(() => parseWebhookSignatureHeader(`v1=${'a'.repeat(64)}`))).toBe('malformed_header');
  });
});

describe('verifyWebhookSignature', () => {
  it('accepts a valid signature within the tolerance', () => {
    const header = generateWebhookSignatureHeader(BODY, SECRET, NOW);
    expect(verifyWebhookSignature(BODY, header, SECRET, { now: NOW + 299 })).toBe(true);
    expect(verifyWebhookSignature(Buffer.from(BODY), header, SECRET, { now: NOW - 299 })).toBe(true);
  });

  it('rejects a timestamp outside the tolerance (replay protection)', () => {
    const header = generateWebhookSignatureHeader(BODY, SECRET, NOW);
    expect(reasonOf(() => verifyWebhookSignature(BODY, header, SECRET, { now: NOW + 301 }))).toBe(
      'timestamp_outside_tolerance',
    );
    expect(reasonOf(() => verifyWebhookSignature(BODY, header, SECRET, { now: NOW + 61, tolerance: 60 }))).toBe(
      'timestamp_outside_tolerance',
    );
    // tolerance 0 disables the check
    expect(verifyWebhookSignature(BODY, header, SECRET, { now: NOW + 99999, tolerance: 0 })).toBe(true);
  });

  it('rejects a tampered body, a wrong secret and a re-serialised body', () => {
    const body = '{ "id": "evt_1", "event": "vat.validated" }';
    const header = generateWebhookSignatureHeader(body, SECRET, NOW);
    expect(reasonOf(() => verifyWebhookSignature(body + ' ', header, SECRET, { now: NOW }))).toBe(
      'no_matching_signature',
    );
    expect(reasonOf(() => verifyWebhookSignature(body, header, 'whsec_other', { now: NOW }))).toBe(
      'no_matching_signature',
    );
    const reserialised = JSON.stringify(JSON.parse(body));
    expect(reasonOf(() => verifyWebhookSignature(reserialised, header, SECRET, { now: NOW }))).toBe(
      'no_matching_signature',
    );
  });

  it('rejects a timestamp that was swapped after signing', () => {
    const header = generateWebhookSignatureHeader(BODY, SECRET, NOW).replace(`t=${NOW}`, `t=${NOW + 10}`);
    expect(reasonOf(() => verifyWebhookSignature(BODY, header, SECRET, { now: NOW }))).toBe('no_matching_signature');
  });

  it('accepts any of several v1 signatures (Taxora-side rotation)', () => {
    const header = generateWebhookSignatureHeader(BODY, ['whsec_new', 'whsec_old'], NOW);
    expect(verifyWebhookSignature(BODY, header, 'whsec_old', { now: NOW })).toBe(true);
    expect(verifyWebhookSignature(BODY, header, 'whsec_new', { now: NOW })).toBe(true);
  });

  it('accepts a list of secrets (receiver-side rotation)', () => {
    const header = generateWebhookSignatureHeader(BODY, 'whsec_b', NOW);
    expect(verifyWebhookSignature(BODY, header, ['whsec_a', 'whsec_b'], { now: NOW })).toBe(true);
  });

  it('refuses an empty secret and an already-parsed body', () => {
    const header = generateWebhookSignatureHeader(BODY, SECRET, NOW);
    expect(reasonOf(() => verifyWebhookSignature(BODY, header, '', { now: NOW }))).toBe('missing_secret');
    expect(reasonOf(() => verifyWebhookSignature(BODY, header, [], { now: NOW }))).toBe('missing_secret');
    expect(
      reasonOf(() =>
        verifyWebhookSignature({ id: 'evt_1' } as unknown as string, header, SECRET, {
          now: NOW,
        }),
      ),
    ).toBe('invalid_body');
  });

  it('throws an error that is also a TaxoraException-compatible Error', () => {
    const header = generateWebhookSignatureHeader(BODY, SECRET, NOW);
    try {
      verifyWebhookSignature(BODY, header, 'whsec_other', { now: NOW });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(WebhookSignatureVerificationError);
      expect((e as WebhookSignatureVerificationError).context.reason).toBe('no_matching_signature');
    }
  });
});

describe('constructWebhookEvent', () => {
  const payload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    event: 'vat.validated',
    timestamp: NOW,
    data: {
      object: {
        id: 1,
        vat_uid: 'ATU12345678',
        state: 'valid',
        company_name: 'Example GmbH',
        country_code: 'AT',
        checked_at: null,
      },
    },
  };

  it('returns a typed, narrowable event', () => {
    const body = JSON.stringify(payload);
    const event: TaxoraWebhookEvent = constructWebhookEvent(
      body,
      generateWebhookSignatureHeader(body, SECRET, NOW),
      SECRET,
      { now: NOW },
    );

    expect(event.id).toBe(payload.id);
    if (event.event !== 'vat.validated') throw new Error('expected vat.validated');
    expect(event.data.object.vat_uid).toBe('ATU12345678');
  });

  it('verifies before parsing', () => {
    const body = JSON.stringify(payload);
    const header = generateWebhookSignatureHeader(body, SECRET, NOW);
    expect(reasonOf(() => constructWebhookEvent(body, header, 'whsec_other', { now: NOW }))).toBe(
      'no_matching_signature',
    );
  });

  it('rejects a correctly signed body that is not a Taxora event', () => {
    for (const body of ['not json', '{"foo":1}']) {
      const header = generateWebhookSignatureHeader(body, SECRET, NOW);
      expect(reasonOf(() => constructWebhookEvent(body, header, SECRET, { now: NOW }))).toBe('invalid_payload');
    }
  });
});

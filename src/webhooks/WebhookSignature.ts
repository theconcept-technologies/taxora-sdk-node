import { createHmac, timingSafeEqual } from 'node:crypto';
import { TaxoraException } from '../exceptions/TaxoraException.js';
import type { TaxoraWebhookEvent } from './WebhookEvent.js';

/** Name of the HTTP header that carries the signature. Node lower-cases it: `req.headers['taxora-signature']`. */
export const WEBHOOK_SIGNATURE_HEADER = 'Taxora-Signature';

/** Name of the HTTP header that carries the delivery UUID (stable across retries). */
export const WEBHOOK_ID_HEADER = 'Taxora-Webhook-Id';

/** Default maximum age (seconds) of a signed request before it is rejected as a possible replay. */
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

const SCHEME = 'v1';

/** The exact bytes Taxora sent. Never pass a parsed-and-re-serialised object. */
export type WebhookRawBody = string | Uint8Array | ArrayBuffer;

/** Header value as frameworks hand it over (Express/Node may give an array for repeated headers). */
export type WebhookSignatureHeaderInput = string | readonly string[] | null | undefined;

export interface WebhookVerifyOptions {
  /**
   * Maximum allowed difference between now and the signature timestamp, in seconds. Default 300.
   * `0` disables the check — not recommended, it re-opens replay attacks.
   */
  tolerance?: number;
  /** Current time in Unix seconds. Only meant for tests. */
  now?: number;
}

export type WebhookSignatureErrorReason =
  | 'missing_secret'
  | 'missing_header'
  | 'malformed_header'
  | 'invalid_body'
  | 'timestamp_outside_tolerance'
  | 'no_matching_signature'
  | 'invalid_payload';

export class WebhookSignatureVerificationError extends TaxoraException {
  public readonly reason: WebhookSignatureErrorReason;

  constructor(message: string, reason: WebhookSignatureErrorReason, context: Record<string, unknown> = {}) {
    super(message, { ...context, reason });
    this.name = 'WebhookSignatureVerificationError';
    this.reason = reason;
  }
}

export interface ParsedWebhookSignatureHeader {
  timestamp: number;
  /** All `v1` signatures — two during a secret rotation on Taxora's side. */
  signatures: string[];
}

/** Parses `t=<unix>,v1=<hex>[,v1=<hex>…]`. Unknown schemes are ignored for forward compatibility. */
export function parseWebhookSignatureHeader(header: WebhookSignatureHeaderInput): ParsedWebhookSignatureHeader {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new WebhookSignatureVerificationError(
      `Missing ${WEBHOOK_SIGNATURE_HEADER} header. Is signing enabled for this webhook endpoint?`,
      'missing_header',
    );
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of value.split(',')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const val = part.slice(separator + 1).trim();

    if (key === 't' && /^\d+$/.test(val)) {
      timestamp = Number(val);
    } else if (key === SCHEME && /^[0-9a-f]{64}$/i.test(val)) {
      signatures.push(val.toLowerCase());
    }
  }

  if (timestamp === null || signatures.length === 0) {
    throw new WebhookSignatureVerificationError(
      `Malformed ${WEBHOOK_SIGNATURE_HEADER} header — expected "t=<unix>,v1=<hex>".`,
      'malformed_header',
    );
  }

  return { timestamp, signatures };
}

/** hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`)) — the value Taxora puts into `v1=`. */
export function computeWebhookSignature(rawBody: WebhookRawBody, timestamp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.`).update(toBytes(rawBody)).digest('hex');
}

/**
 * Builds a valid `Taxora-Signature` header value for a payload — handy for unit-testing your webhook handler
 * without calling Taxora.
 */
export function generateWebhookSignatureHeader(
  rawBody: WebhookRawBody,
  secret: string | readonly string[],
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const secrets = normalizeSecrets(secret);
  return [`t=${timestamp}`, ...secrets.map((s) => `${SCHEME}=${computeWebhookSignature(rawBody, timestamp, s)}`)].join(
    ',',
  );
}

/**
 * Verifies a Taxora webhook request. Returns `true` or throws {@link WebhookSignatureVerificationError}.
 *
 * - `rawBody` must be the unmodified request body (e.g. `express.raw()`, `await request.text()`).
 * - `secret` may be a list — useful while you rotate the secret on your side.
 * - The comparison is constant-time; the timestamp must be within `tolerance` seconds (default 300).
 */
export function verifyWebhookSignature(
  rawBody: WebhookRawBody,
  header: WebhookSignatureHeaderInput,
  secret: string | readonly string[],
  options: WebhookVerifyOptions = {},
): true {
  const secrets = normalizeSecrets(secret);
  const bytes = toBytes(rawBody);
  const { timestamp, signatures } = parseWebhookSignatureHeader(header);

  const tolerance = options.tolerance ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (tolerance > 0 && Math.abs(now - timestamp) > tolerance) {
    throw new WebhookSignatureVerificationError(
      `Timestamp outside the tolerance window (${tolerance}s). Possible replay — or check the server clock.`,
      'timestamp_outside_tolerance',
      { timestamp, now, tolerance },
    );
  }

  const received = signatures.map((s) => Buffer.from(s, 'hex'));
  for (const s of secrets) {
    const expected = Buffer.from(computeWebhookSignature(bytes, timestamp, s), 'hex');
    // Check every pair (no early exit per secret) so timing does not reveal which entry matched.
    let matched = false;
    for (const candidate of received) {
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
        matched = true;
      }
    }
    if (matched) return true;
  }

  throw new WebhookSignatureVerificationError(
    'No signature matches the expected signature for this payload. Make sure you pass the raw request body ' +
      '(not re-serialised JSON) and the full secret including the "whsec_" prefix.',
    'no_matching_signature',
  );
}

/**
 * Verifies the signature and returns the parsed, typed event. Throws {@link WebhookSignatureVerificationError}
 * on any problem — respond with HTTP 400 in that case.
 *
 * ```ts
 * app.post('/taxora-webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   const event = constructWebhookEvent(req.body, req.header('Taxora-Signature'), process.env.TAXORA_WEBHOOK_SECRET!);
 *   if (event.event === 'vat.validated') { ... }
 *   res.sendStatus(200);
 * });
 * ```
 */
export function constructWebhookEvent<T extends TaxoraWebhookEvent = TaxoraWebhookEvent>(
  rawBody: WebhookRawBody,
  header: WebhookSignatureHeaderInput,
  secret: string | readonly string[],
  options: WebhookVerifyOptions = {},
): T {
  verifyWebhookSignature(rawBody, header, secret, options);

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(toBytes(rawBody)).toString('utf8'));
  } catch {
    throw new WebhookSignatureVerificationError('Webhook payload is not valid JSON.', 'invalid_payload');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { id?: unknown }).id !== 'string' ||
    typeof (parsed as { event?: unknown }).event !== 'string' ||
    typeof (parsed as { data?: unknown }).data !== 'object'
  ) {
    throw new WebhookSignatureVerificationError(
      'Webhook payload does not have the expected { id, event, timestamp, data } shape.',
      'invalid_payload',
    );
  }

  return parsed as T;
}

function normalizeSecrets(secret: string | readonly string[]): string[] {
  const list = (typeof secret === 'string' ? [secret] : [...secret]).filter(
    (s): s is string => typeof s === 'string' && s !== '',
  );
  if (list.length === 0) {
    throw new WebhookSignatureVerificationError(
      'No webhook signing secret given. Copy it from the Taxora dashboard (Developer → Webhooks).',
      'missing_secret',
    );
  }
  return list;
}

function toBytes(rawBody: WebhookRawBody): Uint8Array {
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
  if (rawBody instanceof Uint8Array) return rawBody;
  if (rawBody instanceof ArrayBuffer) return new Uint8Array(rawBody);
  throw new WebhookSignatureVerificationError(
    'Webhook body must be the raw request body (string, Buffer or Uint8Array). It looks like it was already ' +
      'parsed as JSON — use express.raw() / request.text() instead of a JSON body parser.',
    'invalid_body',
  );
}

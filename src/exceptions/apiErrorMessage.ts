/**
 * Derives a short, human readable exception message from an API response body.
 *
 * A response body is never used verbatim as an exception message: the gateways
 * in front of the API (DigitalOcean App Platform, load balancers, proxies)
 * answer 5xx with a full HTML error page, and that page would otherwise end up
 * in every log line and stack trace of the integrating application.
 *
 * Only the human readable message of a JSON error body is used; everything else
 * (HTML, empty bodies, binary payloads) falls back to the HTTP status line. The
 * untouched body always stays available via `HttpException.getResponseBody()`.
 */

const MAX_LENGTH = 500;

/** Plain text bodies are only surfaced when they are this short. */
const MAX_PLAIN_LENGTH = 200;

const REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * The message for a failed request: the API message when the body carries one,
 * otherwise a description of the HTTP status.
 */
export function describeApiError(body: string | null | undefined, statusCode: number): string {
  return jsonErrorMessage(body) ?? plainErrorMessage(body) ?? statusErrorMessage(statusCode);
}

/**
 * The failure detail without the surrounding sentence: the API message when
 * there is one, otherwise just the status ("HTTP 504 Gateway Timeout").
 */
export function detailApiError(body: string | null | undefined, statusCode: number): string {
  return jsonErrorMessage(body) ?? plainErrorMessage(body) ?? statusPhrase(statusCode);
}

/** The human readable message of a JSON error body, or null. */
export function jsonErrorMessage(body: string | null | undefined): string | null {
  if (body === null || body === undefined || body.trim() === '') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const payload = parsed as Record<string, unknown>;

  for (const key of ['message', 'error']) {
    const value = payload[key];
    if (typeof value === 'string') {
      const message = sanitize(value);
      if (message !== null) return message;
    }
  }

  const errors = payload['errors'];
  if (typeof errors === 'object' && errors !== null) {
    return fromErrorBag(errors as Record<string, unknown>);
  }

  return null;
}

export function statusErrorMessage(statusCode: number): string {
  return `Taxora API request failed (${statusPhrase(statusCode)}).`;
}

/** e.g. "HTTP 504 Gateway Timeout". */
export function statusPhrase(statusCode: number): string {
  const phrase = REASON_PHRASES[statusCode];

  return `HTTP ${statusCode}${phrase ? ` ${phrase}` : ''}`;
}

/**
 * A short body without any markup (e.g. "upstream request timeout") is safe to
 * surface as is; anything longer or HTML/JSON shaped is not.
 */
function plainErrorMessage(body: string | null | undefined): string | null {
  if (body === null || body === undefined) return null;

  const value = body.replace(/\s+/g, ' ').trim();
  if (value === '' || value.length > MAX_PLAIN_LENGTH) return null;
  if (value.includes('<') || value.includes('{')) return null;

  return value;
}

function fromErrorBag(errors: Record<string, unknown>): string | null {
  for (const [field, messages] of Object.entries(errors)) {
    for (const message of Array.isArray(messages) ? messages : [messages]) {
      if (typeof message !== 'string') continue;
      const sanitized = sanitize(message);
      if (sanitized === null) continue;

      return field !== '' ? `${field}: ${sanitized}` : sanitized;
    }
  }

  return null;
}

/** Single line, length capped, never an HTML document. */
function sanitize(value: string): string | null {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return null;
  if (/<!doctype\s+html|<html[\s>]/i.test(collapsed)) return null;

  return collapsed.length > MAX_LENGTH ? `${collapsed.slice(0, MAX_LENGTH - 1)}…` : collapsed;
}

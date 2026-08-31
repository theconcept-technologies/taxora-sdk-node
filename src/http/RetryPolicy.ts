/**
 * How the SDK retries transient failures.
 *
 * Only gateway-level failures are retried by default (502/503/504): those come
 * from the infrastructure in front of the API, not from the API itself, and a
 * second attempt a moment later usually succeeds. Everything else — 4xx, and any
 * answer the API produced itself — is surfaced immediately.
 *
 * On top of that, a 429 is retried when the API answers with a `Retry-After`
 * telling us how long to wait, and connection-level failures (reset connection,
 * client-side timeout, DNS hiccup) are retried as well — those never reached the
 * API's answer either.
 *
 * Retries are opt-in per operation and are only applied to read-only calls
 * (lookups, downloads, polling). Calls that change state or cost quota — booking
 * a transaction, starting an enrichment job, triggering a certificate export —
 * are never retried automatically, because a gateway timeout does not tell us
 * whether the API already processed the request.
 */
export interface RetryPolicyOptions {
  /** Total attempts including the first one (1 disables retrying). */
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
  /** Honour a `Retry-After` header instead of the backoff, and retry a 429 that carries one. */
  respectRetryAfter?: boolean;
  /** Longest wait accepted from `Retry-After`; a longer one means we give up instead of blocking. */
  maxRetryAfterMs?: number;
  /** Retry connection-level failures (reset connection, client-side timeout, DNS hiccup). */
  retryOnNetworkErrors?: boolean;
  /** Receives the delay in milliseconds; defaults to setTimeout. */
  sleeper?: (delayMs: number) => Promise<void> | void;
}

export const DEFAULT_RETRYABLE_STATUS_CODES = [502, 503, 504];

/** Retried only when the response tells us how long to wait. */
const RETRY_AFTER_ONLY_STATUS_CODES = [429];

/** Node/undici error codes that mean "the request never got an answer". */
const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

export class RetryPolicy {
  public readonly maxAttempts: number;
  public readonly initialDelayMs: number;
  public readonly backoffMultiplier: number;
  public readonly maxDelayMs: number;
  public readonly retryableStatusCodes: number[];
  public readonly respectRetryAfter: boolean;
  public readonly maxRetryAfterMs: number;
  public readonly retryOnNetworkErrors: boolean;
  private readonly sleeper: ((delayMs: number) => Promise<void> | void) | undefined;

  constructor(options: RetryPolicyOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 500;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.maxDelayMs = options.maxDelayMs ?? 5000;
    this.retryableStatusCodes = options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;
    this.respectRetryAfter = options.respectRetryAfter ?? true;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? 10_000;
    this.retryOnNetworkErrors = options.retryOnNetworkErrors ?? true;
    this.sleeper = options.sleeper;

    if (this.maxAttempts < 1) throw new Error('maxAttempts must be at least 1.');
    if (this.initialDelayMs < 0 || this.maxDelayMs < 0) throw new Error('Delays must not be negative.');
    if (this.backoffMultiplier < 1) throw new Error('backoffMultiplier must be at least 1.');
  }

  /** No retrying at all — every failure is surfaced on the first attempt. */
  static disabled(): RetryPolicy {
    return new RetryPolicy({ maxAttempts: 1 });
  }

  /** Retry immediately, without waiting (mainly useful in tests). */
  static withoutDelay(maxAttempts = 3): RetryPolicy {
    return new RetryPolicy({ maxAttempts, initialDelayMs: 0, maxDelayMs: 0 });
  }

  isRetryable(statusCode: number, retryAfterHeader?: string | null): boolean {
    const retryAfterMs = this.retryAfterMs(retryAfterHeader);

    // The API asked for a longer pause than we are willing to block for: hand the
    // caller its 429/503 now instead of sitting on the request.
    if (retryAfterMs !== null && retryAfterMs > this.maxRetryAfterMs) return false;

    if (this.retryableStatusCodes.includes(statusCode)) return true;

    return retryAfterMs !== null && RETRY_AFTER_ONLY_STATUS_CODES.includes(statusCode);
  }

  /** @param attempt Number of attempts made so far (1 = the first one just failed). */
  shouldRetry(statusCode: number, attempt: number, retryAfterHeader?: string | null): boolean {
    return attempt < this.maxAttempts && this.isRetryable(statusCode, retryAfterHeader);
  }

  /**
   * A connection-level failure: the request never got an answer, so repeating it
   * is as safe as repeating a gateway timeout.
   */
  isRetryableError(error: unknown): boolean {
    if (!this.retryOnNetworkErrors || !(error instanceof Error)) return false;

    if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;

    const code = (error as { code?: unknown }).code ?? (error.cause as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) return true;

    // Node's fetch reports every transport problem as `TypeError: fetch failed`.
    return error instanceof TypeError && /fetch failed|network|failed to fetch/i.test(error.message);
  }

  shouldRetryError(error: unknown, attempt: number): boolean {
    return attempt < this.maxAttempts && this.isRetryableError(error);
  }

  /**
   * The wait the API asked for, in milliseconds — seconds or HTTP-date form — or
   * null when there is none, it cannot be parsed, or the header is ignored.
   */
  retryAfterMs(header: string | null | undefined, now: Date = new Date()): number | null {
    if (!this.respectRetryAfter || header === null || header === undefined) return null;

    const value = header.trim();
    if (value === '') return null;

    if (/^\d+$/.test(value)) return Number(value) * 1000;

    const date = Date.parse(value);
    if (Number.isNaN(date)) return null;

    return Math.max(0, date - now.getTime());
  }

  /** The wait before the next attempt: what the API asked for, else exponential backoff. */
  delayMsForAttempt(attempt: number, retryAfterHeader?: string | null): number {
    const retryAfterMs = this.retryAfterMs(retryAfterHeader);
    if (retryAfterMs !== null) return Math.min(retryAfterMs, this.maxRetryAfterMs);

    if (this.initialDelayMs === 0) return 0;

    const delay = Math.round(this.initialDelayMs * this.backoffMultiplier ** Math.max(0, attempt - 1));

    return Math.max(0, Math.min(delay, this.maxDelayMs));
  }

  async sleepBeforeRetry(attempt: number, retryAfterHeader?: string | null): Promise<void> {
    const delayMs = this.delayMsForAttempt(attempt, retryAfterHeader);
    if (delayMs <= 0) return;

    if (this.sleeper) {
      await this.sleeper(delayMs);

      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }
}

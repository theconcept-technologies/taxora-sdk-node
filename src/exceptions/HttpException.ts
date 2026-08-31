import { TaxoraException } from './TaxoraException.js';
import { detailApiError } from './apiErrorMessage.js';

export class HttpException extends TaxoraException {
  public readonly statusCode: number;
  public readonly responseBody: string;
  /** Raw `Retry-After` header of the failed response, when it carried one. */
  public readonly retryAfter: string | null;

  constructor(
    message: string,
    statusCode: number,
    responseBody: string,
    context: Record<string, unknown> = {},
    retryAfter: string | null = null,
  ) {
    super(message, context);
    this.name = 'HttpException';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * The final failure after the SDK retried a transient gateway error, e.g.
   * "Taxora VAT validation failed after 3 attempts (HTTP 504 Gateway Timeout)."
   */
  static afterAttempts(operation: string, attempts: number, last: HttpException): HttpException {
    const detail = detailApiError(last.getResponseBody(), last.getStatusCode());

    return new HttpException(
      `Taxora ${operation} failed after ${attempts} attempts (${detail}).`,
      last.getStatusCode(),
      last.getResponseBody(),
      { ...last.context, attempts, cause: last },
      last.getRetryAfter(),
    );
  }

  getStatusCode(): number {
    return this.statusCode;
  }

  getResponseBody(): string {
    return this.responseBody;
  }

  getRetryAfter(): string | null {
    return this.retryAfter;
  }
}

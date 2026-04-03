import { TaxoraException } from './TaxoraException.js';

export class HttpException extends TaxoraException {
  public readonly statusCode: number;
  public readonly responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string, context: Record<string, unknown> = {}) {
    super(message, context);
    this.name = 'HttpException';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  getStatusCode(): number {
    return this.statusCode;
  }

  getResponseBody(): string {
    return this.responseBody;
  }
}

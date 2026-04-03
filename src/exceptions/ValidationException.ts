import { TaxoraException } from './TaxoraException.js';

export class ValidationException extends TaxoraException {
  public readonly statusCode = 422;
  private readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>, context: Record<string, unknown> = {}) {
    super(message, context);
    this.name = 'ValidationException';
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  getErrors(): Record<string, string[]> {
    return this.errors;
  }
}

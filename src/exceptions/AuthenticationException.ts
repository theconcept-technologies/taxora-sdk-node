import { TaxoraException } from './TaxoraException.js';

export class AuthenticationException extends TaxoraException {
  public readonly statusCode = 401;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    this.name = 'AuthenticationException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TaxoraException extends Error {
  public readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TaxoraException';
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

import { ComplianceTransaction } from './ComplianceTransaction.js';

/**
 * A paginated page of compliance transactions (GET /compliance/transactions).
 */
export class ComplianceTransactionPage implements Iterable<ComplianceTransaction> {
  constructor(
    public readonly rows: ComplianceTransaction[],
    public readonly currentPage: number,
    public readonly perPage: number,
    public readonly total: number,
    public readonly lastPage: number,
  ) {}

  static fromResponse(payload: unknown): ComplianceTransactionPage {
    const obj =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const rows = Array.isArray(obj['data'])
      ? (obj['data'] as unknown[])
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map(ComplianceTransaction.fromArray)
      : [];

    const meta =
      obj['meta'] !== null && typeof obj['meta'] === 'object' && !Array.isArray(obj['meta'])
        ? (obj['meta'] as Record<string, unknown>)
        : {};

    const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

    return new ComplianceTransactionPage(
      rows,
      num(meta['current_page'], 1),
      num(meta['per_page'], rows.length),
      num(meta['total'], rows.length),
      num(meta['last_page'], 1),
    );
  }

  [Symbol.iterator](): Iterator<ComplianceTransaction> {
    return this.rows[Symbol.iterator]();
  }

  get length(): number {
    return this.rows.length;
  }
}

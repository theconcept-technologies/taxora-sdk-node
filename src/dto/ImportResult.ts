/**
 * Result of a CSV transaction import (POST /compliance/transactions/import).
 */
export class ImportResult {
  constructor(
    /** Number of transactions created from the file. */
    public readonly created: number,
    /** Rows skipped because a matching transaction already exists (idempotent re-upload). */
    public readonly skippedDuplicates: number,
    /** Row-level errors, e.g. "Row 3 (INV-1): invalid transaction_type 'x'". */
    public readonly errors: string[],
  ) {}

  static fromArray(data: Record<string, unknown>): ImportResult {
    const errors = (Array.isArray(data['errors']) ? (data['errors'] as unknown[]) : []).filter(
      (row): row is string => typeof row === 'string',
    );

    const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

    return new ImportResult(num(data['created']), num(data['skipped_duplicates']), errors);
  }
}

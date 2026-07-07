import { ComplianceEnrollment } from './ComplianceEnrollment.js';

/**
 * A paginated page of compliance enrollments (GET /compliance/enrollments).
 */
export class ComplianceEnrollmentPage implements Iterable<ComplianceEnrollment> {
  constructor(
    public readonly rows: ComplianceEnrollment[],
    public readonly currentPage: number,
    public readonly perPage: number,
    public readonly total: number,
    public readonly lastPage: number,
  ) {}

  static fromResponse(payload: unknown): ComplianceEnrollmentPage {
    const obj =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const rows = Array.isArray(obj['data'])
      ? (obj['data'] as unknown[])
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map(ComplianceEnrollment.fromArray)
      : [];

    const meta =
      obj['meta'] !== null && typeof obj['meta'] === 'object' && !Array.isArray(obj['meta'])
        ? (obj['meta'] as Record<string, unknown>)
        : {};

    const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

    return new ComplianceEnrollmentPage(
      rows,
      num(meta['current_page'], 1),
      num(meta['per_page'], rows.length),
      num(meta['total'], rows.length),
      num(meta['last_page'], 1),
    );
  }

  [Symbol.iterator](): Iterator<ComplianceEnrollment> {
    return this.rows[Symbol.iterator]();
  }

  get length(): number {
    return this.rows.length;
  }
}

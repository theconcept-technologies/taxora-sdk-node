import { SmartEnrichmentHistoryRow } from './SmartEnrichmentHistoryRow.js';

/**
 * Account-wide history tiles — stable regardless of the current search/page filter.
 */
export interface SmartEnrichmentHistoryStats {
  total: number;
  found: number;
}

/**
 * A paginated page of Smart Enrichment lookup history.
 */
export class SmartEnrichmentHistoryPage implements Iterable<SmartEnrichmentHistoryRow> {
  constructor(
    public readonly rows: SmartEnrichmentHistoryRow[],
    public readonly currentPage: number,
    public readonly perPage: number,
    public readonly total: number,
    public readonly lastPage: number,
    public readonly stats?: SmartEnrichmentHistoryStats,
  ) {}

  static fromResponse(payload: unknown): SmartEnrichmentHistoryPage {
    const obj =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const rows = Array.isArray(obj['data'])
      ? (obj['data'] as unknown[])
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map(SmartEnrichmentHistoryRow.fromArray)
      : [];

    const meta =
      obj['meta'] !== null && typeof obj['meta'] === 'object' && !Array.isArray(obj['meta'])
        ? (obj['meta'] as Record<string, unknown>)
        : {};

    const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

    const statsRaw =
      obj['stats'] !== null && typeof obj['stats'] === 'object' && !Array.isArray(obj['stats'])
        ? (obj['stats'] as Record<string, unknown>)
        : undefined;
    const stats: SmartEnrichmentHistoryStats | undefined = statsRaw
      ? { total: num(statsRaw['total'], 0), found: num(statsRaw['found'], 0) }
      : undefined;

    return new SmartEnrichmentHistoryPage(
      rows,
      num(meta['currentPage'], 1),
      num(meta['perPage'], rows.length),
      num(meta['total'], rows.length),
      num(meta['lastPage'], 1),
      stats,
    );
  }

  [Symbol.iterator](): Iterator<SmartEnrichmentHistoryRow> {
    return this.rows[Symbol.iterator]();
  }

  get length(): number {
    return this.rows.length;
  }
}

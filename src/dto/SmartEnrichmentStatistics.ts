/**
 * DTOs for the Smart Enrichment statistics endpoint
 * (GET /smart-enrichment/statistics).
 *
 * Read-only aggregation over the company's lookups: headline totals, a time
 * series and breakdowns by source, outcome and confidence band. The API
 * defaults to the last 12 months and a monthly interval.
 */

/** Time-series bucket size accepted by the statistics endpoint. */
export type SmartEnrichmentStatisticsInterval = 'day' | 'week' | 'month';

export interface SmartEnrichmentStatisticsRange {
  dateFrom: string;
  dateTo: string;
  interval: string;
}

export interface SmartEnrichmentStatisticsTotals {
  jobs: number;
  items: number;
  found: number;
  /** Share of items that resolved to a VAT number, 0–100. */
  foundRate: number;
  /** Average confidence of found items, 0–100. */
  avgConfidence: number;
}

export interface SmartEnrichmentTimeBucket {
  /** Period key: "2026-01-15" (day), "2026-03" (ISO year-week) or "2026-01" (month). */
  bucket: string;
  jobs: number;
  items: number;
  found: number;
}

export interface SmartEnrichmentSourceBreakdown {
  source: string;
  jobs: number;
  found: number;
}

export interface SmartEnrichmentOutcomeBreakdown {
  outcome: string;
  count: number;
}

export interface SmartEnrichmentConfidenceBucket {
  /** Confidence band: "high", "medium" or "low". */
  bucket: string;
  count: number;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
}

export class SmartEnrichmentStatistics {
  constructor(
    public readonly range: SmartEnrichmentStatisticsRange,
    public readonly totals: SmartEnrichmentStatisticsTotals,
    public readonly timeSeries: SmartEnrichmentTimeBucket[],
    public readonly bySource: SmartEnrichmentSourceBreakdown[],
    public readonly byOutcome: SmartEnrichmentOutcomeBreakdown[],
    public readonly confidenceBuckets: SmartEnrichmentConfidenceBucket[],
  ) {}

  static fromArray(data: Record<string, unknown>): SmartEnrichmentStatistics {
    const range = asRecord(data['range']);
    const totals = asRecord(data['totals']);

    const timeSeries: SmartEnrichmentTimeBucket[] = asRecords(data['time_series']).map((row) => ({
      bucket: asString(row['bucket']),
      jobs: asNumber(row['jobs']),
      items: asNumber(row['items']),
      found: asNumber(row['found']),
    }));

    const bySource: SmartEnrichmentSourceBreakdown[] = asRecords(data['by_source']).map((row) => ({
      source: asString(row['source']),
      jobs: asNumber(row['jobs']),
      found: asNumber(row['found']),
    }));

    const byOutcome: SmartEnrichmentOutcomeBreakdown[] = asRecords(data['by_outcome']).map((row) => ({
      outcome: asString(row['outcome']),
      count: asNumber(row['count']),
    }));

    const confidenceBuckets: SmartEnrichmentConfidenceBucket[] = asRecords(data['confidence_buckets']).map((row) => ({
      bucket: asString(row['bucket']),
      count: asNumber(row['count']),
    }));

    return new SmartEnrichmentStatistics(
      {
        dateFrom: asString(range['date_from']),
        dateTo: asString(range['date_to']),
        interval: asString(range['interval']),
      },
      {
        jobs: asNumber(totals['jobs']),
        items: asNumber(totals['items']),
        found: asNumber(totals['found']),
        foundRate: asNumber(totals['found_rate']),
        avgConfidence: asNumber(totals['avg_confidence']),
      },
      timeSeries,
      bySource,
      byOutcome,
      confidenceBuckets,
    );
  }
}

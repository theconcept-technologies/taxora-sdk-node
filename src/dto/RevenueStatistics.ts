/**
 * DTOs for the e-reporting revenue statistics endpoint
 * (GET /compliance/revenue-statistics).
 *
 * Monetary values are kept as the 4-decimal strings returned by the API (no
 * Number conversion) to preserve precision. All headline figures are expressed
 * in `primaryCurrency`; when `isMultiCurrency` is true, `byCurrency` lists every
 * currency present in the range.
 */

export interface RevenueTotals {
  count: number;
  subtotal: string;
  taxAmount: string;
  total: string;
}

export interface RevenueTimeBucket extends RevenueTotals {
  /** Period key: "2026-01-15" (day), "2026-03" (ISO year-week) or "2026-01" (month). */
  bucket: string;
}

export interface RevenueTypeBreakdown {
  type: string;
  typeLabel: string;
  count: number;
  total: string;
}

export interface RevenueCountryBreakdown {
  /** Counterparty country code; "unknown" groups transactions with no partner country. */
  country: string;
  count: number;
  total: string;
}

export interface RevenueStateBreakdown {
  state: string;
  stateLabel: string;
  count: number;
  total: string;
}

export interface RevenueCurrencyBreakdown extends RevenueTotals {
  currency: string;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function asMoney(value: unknown): string {
  return typeof value === 'string' ? value : '0.0000';
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
}

function toTotals(data: Record<string, unknown>): RevenueTotals {
  return {
    count: asNumber(data['count']),
    subtotal: asMoney(data['subtotal']),
    taxAmount: asMoney(data['tax_amount']),
    total: asMoney(data['total']),
  };
}

export class RevenueStatistics {
  constructor(
    public readonly dateFrom: string | undefined,
    public readonly dateTo: string | undefined,
    public readonly interval: string | undefined,
    public readonly primaryCurrency: string,
    public readonly isMultiCurrency: boolean,
    public readonly totals: RevenueTotals,
    public readonly timeSeries: RevenueTimeBucket[],
    public readonly byType: RevenueTypeBreakdown[],
    public readonly byCountry: RevenueCountryBreakdown[],
    public readonly byState: RevenueStateBreakdown[],
    public readonly byCurrency: RevenueCurrencyBreakdown[],
  ) {}

  static fromArray(data: Record<string, unknown>): RevenueStatistics {
    const range =
      typeof data['range'] === 'object' && data['range'] !== null ? (data['range'] as Record<string, unknown>) : {};

    const totals = toTotals(
      typeof data['totals'] === 'object' && data['totals'] !== null ? (data['totals'] as Record<string, unknown>) : {},
    );

    const timeSeries: RevenueTimeBucket[] = asRecords(data['time_series']).map((row) => ({
      bucket: asString(row['bucket']),
      ...toTotals(row),
    }));

    const byType: RevenueTypeBreakdown[] = asRecords(data['by_type']).map((row) => ({
      type: asString(row['type']),
      typeLabel: asString(row['type_label']),
      count: asNumber(row['count']),
      total: asMoney(row['total']),
    }));

    const byCountry: RevenueCountryBreakdown[] = asRecords(data['by_country']).map((row) => ({
      country: asString(row['country'], 'unknown'),
      count: asNumber(row['count']),
      total: asMoney(row['total']),
    }));

    const byState: RevenueStateBreakdown[] = asRecords(data['by_state']).map((row) => ({
      state: asString(row['state']),
      stateLabel: asString(row['state_label']),
      count: asNumber(row['count']),
      total: asMoney(row['total']),
    }));

    const byCurrency: RevenueCurrencyBreakdown[] = asRecords(data['by_currency']).map((row) => ({
      currency: asString(row['currency']),
      ...toTotals(row),
    }));

    return new RevenueStatistics(
      asString(range['date_from']) || undefined,
      asString(range['date_to']) || undefined,
      asString(range['interval']) || undefined,
      asString(data['primary_currency'], 'EUR'),
      data['is_multi_currency'] === true,
      totals,
      timeSeries,
      byType,
      byCountry,
      byState,
      byCurrency,
    );
  }
}

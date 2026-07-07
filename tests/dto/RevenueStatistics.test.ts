import { describe, it, expect } from 'vitest';
import { RevenueStatistics } from '../../src/dto/RevenueStatistics.js';

describe('RevenueStatistics.fromArray', () => {
  it('maps snake_case keys to camelCase and preserves money strings', () => {
    const stats = RevenueStatistics.fromArray({
      range: { date_from: '2025-06-01', date_to: '2026-05-31', interval: 'week' },
      primary_currency: 'USD',
      is_multi_currency: true,
      totals: { count: 10, subtotal: '1000.0000', tax_amount: '200.0000', total: '1200.0000' },
      time_series: [{ bucket: '2026-03', count: 4, subtotal: '400.0000', tax_amount: '80.0000', total: '480.0000' }],
      by_type: [{ type: 'crossborder_outbound', type_label: 'Cross-border outbound', count: 4, total: '480.0000' }],
      by_country: [{ country: 'fr', count: 4, total: '480.0000' }],
      by_state: [{ state: 'pending', state_label: 'Pending', count: 4, total: '480.0000' }],
      by_currency: [
        { currency: 'USD', count: 6, subtotal: '600.0000', tax_amount: '120.0000', total: '720.0000' },
        { currency: 'EUR', count: 4, subtotal: '400.0000', tax_amount: '80.0000', total: '480.0000' },
      ],
    });

    expect(stats.dateFrom).toBe('2025-06-01');
    expect(stats.dateTo).toBe('2026-05-31');
    expect(stats.interval).toBe('week');
    expect(stats.primaryCurrency).toBe('USD');
    expect(stats.isMultiCurrency).toBe(true);
    expect(stats.totals.taxAmount).toBe('200.0000');
    expect(stats.timeSeries[0]!.bucket).toBe('2026-03');
    expect(stats.byType[0]!.typeLabel).toBe('Cross-border outbound');
    expect(stats.byCurrency).toHaveLength(2);
  });

  it('defaults gracefully on an empty payload', () => {
    const stats = RevenueStatistics.fromArray({});

    expect(stats.primaryCurrency).toBe('EUR');
    expect(stats.isMultiCurrency).toBe(false);
    expect(stats.dateFrom).toBeUndefined();
    expect(stats.totals.count).toBe(0);
    expect(stats.totals.total).toBe('0.0000');
    expect(stats.timeSeries).toEqual([]);
    expect(stats.byType).toEqual([]);
    expect(stats.byCountry).toEqual([]);
  });

  it('groups missing counterparty country as "unknown"', () => {
    const stats = RevenueStatistics.fromArray({
      by_country: [{ count: 2, total: '50.0000' }],
    });

    expect(stats.byCountry[0]!.country).toBe('unknown');
  });
});

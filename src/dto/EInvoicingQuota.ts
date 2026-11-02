function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asInt(value: unknown): number {
  return typeof value === 'number' ? Math.trunc(value) : Number(value ?? 0) || 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** One month of the e-invoicing allowance (documents included, used, still free, what is due beyond it). */
export class EInvoicingQuotaPeriod {
  constructor(
    /** Billing period, YYYY-MM. */
    public readonly period: string,
    public readonly used: number,
    public readonly included: number,
    public readonly freeUsed: number,
    public readonly freeRemaining: number,
    public readonly billableUnits: number,
    /** Net EUR due for documents beyond the allowance. */
    public readonly amount: string,
    /** Agreed monthly base fee (net EUR) for this month, null when none. */
    public readonly monthlyFee: string | null,
    /** Net EUR due for the month: base fee + documents beyond the allowance. */
    public readonly total: string,
    /** open | included | pending_billing | billed */
    public readonly state: string,
    /** Documents used per country code. */
    public readonly byCountry: Record<string, number>,
    public readonly billedAt: string | null,
    /** Our invoice number once invoiced. */
    public readonly manualReference: string | null,
    public readonly monthlyFeeReference: string | null,
  ) {}

  static fromArray(data: Record<string, unknown>): EInvoicingQuotaPeriod {
    const byCountry: Record<string, number> = {};
    if (Array.isArray(data['by_country'])) {
      for (const row of data['by_country']) {
        const entry = asRecord(row);
        if (entry && typeof entry['country'] === 'string') {
          byCountry[entry['country']] = asInt(entry['used']);
        }
      }
    }

    return new EInvoicingQuotaPeriod(
      asString(data['period']),
      asInt(data['used']),
      asInt(data['included']),
      asInt(data['free_used']),
      asInt(data['free_remaining']),
      asInt(data['billable_units']),
      asString(data['amount'], '0.00'),
      asNullableString(data['monthly_fee']),
      asString(data['total'], '0.00'),
      asString(data['state'], 'open'),
      byCountry,
      asNullableString(data['billed_at']),
      asNullableString(data['manual_reference']),
      asNullableString(data['monthly_fee_reference']),
    );
  }
}

export interface EInvoicingQuotaTier {
  /** Cumulative documents per month up to which the price applies; null = no upper bound. */
  upTo: number | null;
  /** Net EUR per document. */
  unitPrice: string;
}

/** The company's e-invoicing allowance: one pool over all e-invoicing countries. */
export class EInvoicingQuota {
  constructor(
    /** How documents beyond the allowance are paid: "subscription" (on the plan's invoice) or "invoice" (invoiced separately). */
    public readonly billing: string,
    public readonly plan: string | null,
    public readonly currency: string,
    /** Documents included per month. */
    public readonly included: number,
    public readonly tiers: EInvoicingQuotaTier[],
    public readonly countries: string[],
    /** Agreed monthly base fee (net EUR), null when none. */
    public readonly monthlyFee: string | null,
    public readonly current: EInvoicingQuotaPeriod,
    /** Earlier months, newest first. */
    public readonly history: EInvoicingQuotaPeriod[],
  ) {}

  static fromArray(data: Record<string, unknown>): EInvoicingQuota {
    const tiers: EInvoicingQuotaTier[] = [];
    if (Array.isArray(data['tiers'])) {
      for (const row of data['tiers']) {
        const tier = asRecord(row);
        if (tier) {
          tiers.push({
            upTo: tier['up_to'] === null || tier['up_to'] === undefined ? null : asInt(tier['up_to']),
            unitPrice: asString(tier['unit_price'], '0'),
          });
        }
      }
    }

    const history: EInvoicingQuotaPeriod[] = [];
    if (Array.isArray(data['history'])) {
      for (const row of data['history']) {
        const period = asRecord(row);
        if (period) history.push(EInvoicingQuotaPeriod.fromArray(period));
      }
    }

    return new EInvoicingQuota(
      asString(data['billing'], 'invoice'),
      asNullableString(data['plan']),
      asString(data['currency'], 'EUR'),
      asInt(data['included']),
      tiers,
      Array.isArray(data['countries']) ? data['countries'].map(String) : [],
      asNullableString(data['monthly_fee']),
      EInvoicingQuotaPeriod.fromArray(asRecord(data['current']) ?? {}),
      history,
    );
  }
}

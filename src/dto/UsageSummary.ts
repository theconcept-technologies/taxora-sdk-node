function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecordList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => asRecord(row) !== null) : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** One billable usage event of a summary (only included by billing.getUsageSummaries(period)). */
export interface UsageEvent {
  id: number;
  usageSummaryId: number | null;
  feature: string;
  country: string | null;
  regime: string | null;
  billingPeriod: string;
  /** What was billed, e.g. a compliance transaction. */
  resourceType: string | null;
  resourceId: number | null;
  stripeUsageRecordId: string | null;
  stripeReportedAt: string | null;
  createdAt: string | null;
}

/**
 * Billed usage of one feature (e.g. `ereporting_transaction`) in one billing
 * period (YYYY-MM) — GET /billing/usage-summaries.
 */
export class UsageSummary {
  constructor(
    public readonly id: number,
    public readonly companyId: number,
    public readonly feature: string,
    public readonly country: string | null,
    public readonly regime: string | null,
    /** Billing period, YYYY-MM. */
    public readonly billingPeriod: string,
    public readonly eventCount: number,
    /** Precision-safe decimal string as returned by the API (e.g. "49.00"); null until priced. */
    public readonly billableAmount: string | null,
    /** e.g. "open"; free-form so new states don't break parsing. */
    public readonly state: string | null,
    public readonly stateLabel: string | null,
    public readonly periodClosedAt: string | null,
    public readonly billingTriggeredAt: string | null,
    public readonly billedAt: string | null,
    public readonly stripeInvoiceId: string | null,
    public readonly stripeSubscriptionItemId: string | null,
    public readonly billingNotes: string | null,
    /** The period's usage events — only filled by getUsageSummaries(period); empty in the list. */
    public readonly events: UsageEvent[],
    public readonly createdAt: string | null,
    public readonly updatedAt: string | null,
  ) {}

  static fromArray(data: Record<string, unknown>): UsageSummary {
    const amount = data['billable_amount'];

    return new UsageSummary(
      asNumber(data['id']),
      asNumber(data['company_id']),
      asString(data['feature']),
      asNullableString(data['country']),
      asNullableString(data['regime']),
      asString(data['billing_period']),
      asNumber(data['event_count']),
      typeof amount === 'string' ? amount : typeof amount === 'number' ? String(amount) : null,
      asNullableString(data['state']),
      asNullableString(data['state_label']),
      asNullableString(data['period_closed_at']),
      asNullableString(data['billing_triggered_at']),
      asNullableString(data['billed_at']),
      asNullableString(data['stripe_invoice_id']),
      asNullableString(data['stripe_subscription_item_id']),
      asNullableString(data['billing_notes']),
      asRecordList(data['events']).map((event): UsageEvent => ({
        id: asNumber(event['id']),
        usageSummaryId: asNullableNumber(event['usage_summary_id']),
        feature: asString(event['feature']),
        country: asNullableString(event['country']),
        regime: asNullableString(event['regime']),
        billingPeriod: asString(event['billing_period']),
        resourceType: asNullableString(event['resource_type']),
        resourceId: asNullableNumber(event['resource_id']),
        stripeUsageRecordId: asNullableString(event['stripe_usage_record_id']),
        stripeReportedAt: asNullableString(event['stripe_reported_at']),
        createdAt: asNullableString(event['created_at']),
      })),
      asNullableString(data['created_at']),
      asNullableString(data['updated_at']),
    );
  }
}

/** A paginated page of usage summaries (newest billing period first). */
export class UsageSummaryPage implements Iterable<UsageSummary> {
  constructor(
    public readonly rows: UsageSummary[],
    public readonly currentPage: number,
    public readonly perPage: number,
    public readonly total: number,
    public readonly lastPage: number,
  ) {}

  static fromResponse(payload: unknown): UsageSummaryPage {
    const obj = asRecord(payload) ?? {};
    const rows = asRecordList(obj['data']).map(UsageSummary.fromArray);
    const meta = asRecord(obj['meta']) ?? {};
    const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

    return new UsageSummaryPage(
      rows,
      num(meta['current_page'], 1),
      num(meta['per_page'], rows.length),
      num(meta['total'], rows.length),
      num(meta['last_page'], 1),
    );
  }

  [Symbol.iterator](): Iterator<UsageSummary> {
    return this.rows[Symbol.iterator]();
  }

  get length(): number {
    return this.rows.length;
  }
}

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

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** One bookable plan of a country offering. Fees are net EUR amounts. */
export interface ComplianceOfferingPlan {
  key: string;
  monthlyFee: number | null;
  setupFee: number | null;
  /** Usage tiers as configured server-side (raw objects). */
  usageTiers: unknown[];
  volumeLimit: unknown;
  /** Contact-only plans cannot be booked via createCheckout(). */
  contactOnly: boolean;
  /** True when createCheckout() can be started for this plan right now. */
  checkoutAvailable: boolean;
  /** Prerequisites of the plan (e.g. a France e-reporting plan); null when there are none. */
  requires: unknown[] | null;
  /** Whether the company meets `requires`. */
  eligible: boolean;
}

/** A country offering with the company's current state for it. */
export interface ComplianceOffering {
  /** Upper-case ISO 3166-1 alpha-2 code. */
  country: string;
  /** "e_reporting" or "e_invoicing". */
  service: string;
  currency: string;
  active: boolean;
  /** The plan was bought via Stripe self-service (vs. granted manually). */
  viaStripe: boolean;
  plan: string | null;
  status: string | null;
  enrolled: boolean;
  plans: ComplianceOfferingPlan[];
}

/** A country Taxora reaches — bookable self-service or set up on request. */
export interface ComplianceCoverageCountry {
  country: string;
  /** "bookable" or "on_request". */
  availability: string;
  services: string[];
  network: string | null;
  format: string | null;
  mandate: string | null;
}

/**
 * GET /compliance/offerings — bookable compliance plans per country, every
 * reachable country, and which services the company has unlocked.
 */
export class ComplianceOfferings {
  constructor(
    public readonly offerings: ComplianceOffering[],
    public readonly coverage: ComplianceCoverageCountry[],
    /** Company-wide: is the service unlocked anywhere. */
    public readonly access: { eReporting: boolean; eInvoicing: boolean },
    /** Per country (upper-case code) and service (`e_reporting` / `e_invoicing`). */
    public readonly accessByCountry: Record<string, Record<string, boolean>>,
  ) {}

  static fromArray(data: Record<string, unknown>): ComplianceOfferings {
    const offerings = asRecordList(data['data']).map((row): ComplianceOffering => ({
      country: asString(row['country']),
      service: asString(row['service']),
      currency: asString(row['currency'], 'EUR'),
      active: row['active'] === true,
      viaStripe: row['via_stripe'] === true,
      plan: asNullableString(row['plan']),
      status: asNullableString(row['status']),
      enrolled: row['enrolled'] === true,
      plans: asRecordList(row['plans']).map((plan): ComplianceOfferingPlan => ({
        key: asString(plan['key']),
        monthlyFee: asNullableNumber(plan['monthly_fee']),
        setupFee: asNullableNumber(plan['setup_fee']),
        usageTiers: Array.isArray(plan['usage_tiers']) ? (plan['usage_tiers'] as unknown[]) : [],
        volumeLimit: plan['volume_limit'] ?? null,
        contactOnly: plan['contact_only'] === true,
        checkoutAvailable: plan['checkout_available'] === true,
        requires: Array.isArray(plan['requires']) ? (plan['requires'] as unknown[]) : null,
        eligible: plan['eligible'] === true,
      })),
    }));

    const coverage = asRecordList(data['coverage']).map((row): ComplianceCoverageCountry => ({
      country: asString(row['country']),
      availability: asString(row['availability']),
      services: asStringList(row['services']),
      network: asNullableString(row['network']),
      format: asNullableString(row['format']),
      mandate: asNullableString(row['mandate']),
    }));

    const access = asRecord(data['access']) ?? {};
    const accessByCountry: Record<string, Record<string, boolean>> = {};
    for (const [country, services] of Object.entries(asRecord(data['access_by_country']) ?? {})) {
      const flags: Record<string, boolean> = {};
      for (const [service, value] of Object.entries(asRecord(services) ?? {})) {
        flags[service] = value === true;
      }
      accessByCountry[country] = flags;
    }

    return new ComplianceOfferings(
      offerings,
      coverage,
      { eReporting: access['e_reporting'] === true, eInvoicing: access['e_invoicing'] === true },
      accessByCountry,
    );
  }
}

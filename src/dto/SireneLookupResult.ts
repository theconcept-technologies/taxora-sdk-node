function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Company data resolved from the French SIRENE registry
 * (GET /compliance/sirene-lookup). Maps 1:1 onto the createEnrollment input.
 */
export class SireneLookupResult {
  constructor(
    public readonly companyName: string,
    public readonly siren: string,
    public readonly siret: string | null,
    /** 2-digit NAF division, e.g. "47". */
    public readonly nafCode: string | null,
    /** Full NAF/APE code, e.g. "47.11D". */
    public readonly nafFull: string | null,
    /** Mapped enterprise size ("micro", "pme", "eti" or "ge"); null when unmappable. */
    public readonly enterpriseSize: string | null,
    public readonly address: string | null,
    public readonly city: string | null,
    public readonly postalcode: string | null,
  ) {}

  static fromArray(data: Record<string, unknown>): SireneLookupResult {
    return new SireneLookupResult(
      asString(data['company_name']),
      asString(data['siren']),
      asNullableString(data['siret']),
      asNullableString(data['naf_code']),
      asNullableString(data['naf_full']),
      asNullableString(data['enterprise_size']),
      asNullableString(data['address']),
      asNullableString(data['city']),
      asNullableString(data['postalcode']),
    );
  }
}

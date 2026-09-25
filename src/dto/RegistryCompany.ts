function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * A company from a national company register (GET /compliance/registry-lookup) —
 * for Norway the Brønnøysund Enhetsregisteret. Maps onto the Norway enrollment
 * input and the buyer fields of a Norwegian e-invoice.
 */
export class RegistryCompany {
  constructor(
    /** 9-digit Norwegian organisation number. */
    public readonly orgNumber: string,
    public readonly companyName: string,
    /** Legal form, e.g. "AS" or "ASA". */
    public readonly organisationForm: string | null,
    /** Registered for VAT (Merverdiavgiftsregisteret). */
    public readonly vatRegistered: boolean,
    /** "NO…MVA" VAT number; null when not VAT-registered. */
    public readonly vatNumber: string | null,
    /** Registered in Foretaksregisteret (adds "Foretaksregisteret" to invoices). */
    public readonly enterpriseRegister: boolean,
    public readonly bankrupt: boolean,
    public readonly underLiquidation: boolean,
    public readonly address: string | null,
    public readonly postalcode: string | null,
    public readonly city: string | null,
    /** 2-char ISO 3166-1 alpha-2 code, e.g. "NO". */
    public readonly country: string,
  ) {}

  static fromArray(data: Record<string, unknown>): RegistryCompany {
    return new RegistryCompany(
      asString(data['org_number']),
      asString(data['company_name']),
      asNullableString(data['organisation_form']),
      data['vat_registered'] === true,
      asNullableString(data['vat_number']),
      data['enterprise_register'] === true,
      data['bankrupt'] === true,
      data['under_liquidation'] === true,
      asNullableString(data['address']),
      asNullableString(data['postalcode']),
      asNullableString(data['city']),
      asString(data['country']),
    );
  }
}

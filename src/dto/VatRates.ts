/**
 * One VAT rate / DGFiP tax category offered for a reporting country.
 */
export interface VatRate {
  /** VAT percentage, e.g. 20 or 5.5. */
  percent: number;
  /** DGFiP tax category code (S/AA/AAA/K/G/AE/E/Z). */
  category: string;
  /** i18n key for the rate label, e.g. "fr_standard". */
  labelKey: string;
  /** Default tax designation prefilled into invoice lines, e.g. "TVA". */
  taxName: string;
  /** True when a VATEX exemption code is mandatory in the line's `comment` (category E). */
  requiresVatex: boolean;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * The canonical VAT rates & DGFiP tax categories for a reporting country
 * (GET /compliance/vat-rates).
 */
export class VatRates {
  constructor(
    public readonly country: string,
    public readonly currency: string,
    public readonly rates: VatRate[],
  ) {}

  static fromArray(data: Record<string, unknown>): VatRates {
    const rates: VatRate[] = (Array.isArray(data['rates']) ? (data['rates'] as unknown[]) : [])
      .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
      .map((row) => ({
        percent: asNumber(row['percent']),
        category: asString(row['category']),
        labelKey: asString(row['label_key']),
        taxName: asString(row['tax_name']),
        requiresVatex: row['requires_vatex'] === true,
      }));

    return new VatRates(asString(data['country']), asString(data['currency'], 'EUR'), rates);
  }
}

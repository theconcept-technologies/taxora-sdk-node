/**
 * Tax category of an invoice line (UNCL5305 / DGFiP codes). Which categories and rates a country
 * accepts is in eReporting.getVatRates(); Norway uses S (25 / 15 / 12 %), Z, E (with a VATEX code)
 * and AE (reverse charge).
 */
export const ComplianceTaxCategory = {
  STANDARD: 'S',
  REDUCED: 'AA',
  SUPER_REDUCED: 'AAA',
  INTRA_COMMUNITY: 'K',
  EXPORT: 'G',
  REVERSE_CHARGE: 'AE',
  EXEMPT: 'E',
  ZERO: 'Z',
} as const;

export type ComplianceTaxCategory = (typeof ComplianceTaxCategory)[keyof typeof ComplianceTaxCategory];

const CODES: readonly string[] = Object.values(ComplianceTaxCategory);

/** Strict mapping for input: any case is accepted, an unknown code returns null. */
export function parseComplianceTaxCategory(value: unknown): ComplianceTaxCategory | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return CODES.includes(code) ? (code as ComplianceTaxCategory) : null;
}

/** All valid codes, for error messages. */
export const COMPLIANCE_TAX_CATEGORY_CODES: readonly string[] = CODES;

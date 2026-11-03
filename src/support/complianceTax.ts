import { type ComplianceInvoiceTaxInput } from '../endpoints/EReportingEndpoint.js';
import { ComplianceTaxCategory } from '../enums/ComplianceTaxCategory.js';

/**
 * Taxes for invoice lines without remembering category codes. The rate itself is the seller's to know;
 * the API checks it against the country's catalogue (see eReporting.getVatRates()). The name defaults to "VAT".
 */
export const ComplianceTax = {
  /**
   * A taxed rate above 0 %, category S (Norway: 25 / 15 / 12 % are all S). Where a country files reduced rates
   * under their own category (France: AA / AAA), pass it as `category`.
   */
  rate(
    percent: number,
    name = 'VAT',
    category: ComplianceInvoiceTaxInput['category'] = ComplianceTaxCategory.STANDARD,
  ): ComplianceInvoiceTaxInput {
    if (!Number.isFinite(percent) || percent <= 0) {
      throw new Error('rate() needs a percent above 0; for 0 % use zeroRated(), exempt() or reverseCharge().');
    }
    return { name, percent, category };
  },

  /** 0 % but taxable (category Z). */
  zeroRated(name = 'VAT'): ComplianceInvoiceTaxInput {
    return { name, percent: 0, category: ComplianceTaxCategory.ZERO };
  },

  /** Exempt from VAT (category E); the VATEX exemption code is mandatory. */
  exempt(exemptionCode: string, name = 'VAT'): ComplianceInvoiceTaxInput {
    if (exemptionCode.trim() === '') {
      throw new Error('An exempt (category E) tax needs the exemption code (VATEX).');
    }
    return { name, percent: 0, category: ComplianceTaxCategory.EXEMPT, comment: exemptionCode };
  },

  /** Reverse charge (category AE); the mandatory legal text is added by Taxora. */
  reverseCharge(name = 'VAT'): ComplianceInvoiceTaxInput {
    return { name, percent: 0, category: ComplianceTaxCategory.REVERSE_CHARGE };
  },
} as const;

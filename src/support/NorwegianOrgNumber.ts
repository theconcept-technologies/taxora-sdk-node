const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * Norwegian organisation number (organisasjonsnummer): 9 digits, the last one a
 * modulus-11 check digit (weights 3,2,7,6,5,4,3,2). It is also the Peppol
 * participant identifier under scheme 0192 and — with the "NO" prefix and "MVA"
 * suffix — the Norwegian VAT number.
 *
 * Mirrors the backend's validation, so invalid numbers are rejected before a
 * request is sent.
 */
export const NorwegianOrgNumber = {
  /** Peppol identifier scheme for Norwegian organisation numbers. */
  PEPPOL_SCHEME: '0192',

  /**
   * Strips whitespace, dots, dashes, a "0192:" Peppol scheme prefix, the "NO"
   * prefix and the "MVA" suffix: "NO 923 609 016 MVA", "923609016MVA" and
   * "923 609 016" all become "923609016". Does not validate.
   */
  normalize(value: string | null | undefined): string {
    let v = (value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s.-]/g, '');

    if (v.startsWith('0192:')) v = v.slice(5);
    if (v.startsWith('NO')) v = v.slice(2);
    if (v.endsWith('MVA')) v = v.slice(0, -3);

    return v;
  },

  /** True when the (normalized) value is 9 digits with a valid mod-11 check digit. */
  isValid(value: string | null | undefined): boolean {
    const digits = NorwegianOrgNumber.normalize(value);
    if (!/^\d{9}$/.test(digits)) return false;

    let sum = 0;
    for (let i = 0; i < WEIGHTS.length; i++) {
      sum += Number(digits[i]) * WEIGHTS[i]!;
    }

    let check = 11 - (sum % 11);
    if (check === 11) check = 0;

    // Remainder 1 → check digit 10 is impossible; such numbers are never issued.
    return check !== 10 && check === Number(digits[8]);
  },

  /** "NO923609016MVA" — the Norwegian VAT number of an MVA-registered entity. Does not validate. */
  toVatNumber(value: string): string {
    return `NO${NorwegianOrgNumber.normalize(value)}MVA`;
  },
} as const;

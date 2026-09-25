import { describe, it, expect } from 'vitest';
import { NorwegianOrgNumber } from '../../src/support/NorwegianOrgNumber.js';

describe('NorwegianOrgNumber', () => {
  it('accepts valid organisation numbers', () => {
    expect(NorwegianOrgNumber.isValid('923609016')).toBe(true);
    expect(NorwegianOrgNumber.isValid('974760673')).toBe(true);
  });

  it('rejects a wrong check digit, wrong length, non-digits and empty input', () => {
    expect(NorwegianOrgNumber.isValid('923609017')).toBe(false);
    expect(NorwegianOrgNumber.isValid('92360901')).toBe(false);
    expect(NorwegianOrgNumber.isValid('9236090160')).toBe(false);
    expect(NorwegianOrgNumber.isValid('92360901A')).toBe(false);
    expect(NorwegianOrgNumber.isValid('')).toBe(false);
    expect(NorwegianOrgNumber.isValid(null)).toBe(false);
    expect(NorwegianOrgNumber.isValid(undefined)).toBe(false);
  });

  it('rejects numbers whose computed check digit would be 10', () => {
    // 10000013x: weighted sum = 1*3 + 1*3 + 3*2 = 12 → 12 % 11 = 1 → check digit 10 (never issued)
    for (let d = 0; d <= 9; d++) {
      expect(NorwegianOrgNumber.isValid(`10000013${d}`)).toBe(false);
    }
  });

  it('normalizes spaces, dots, dashes, NO prefix, MVA suffix and the 0192 scheme prefix', () => {
    expect(NorwegianOrgNumber.normalize('NO 923 609 016 MVA')).toBe('923609016');
    expect(NorwegianOrgNumber.normalize('923609016MVA')).toBe('923609016');
    expect(NorwegianOrgNumber.normalize('no923.609-016mva')).toBe('923609016');
    expect(NorwegianOrgNumber.normalize('0192:923609016')).toBe('923609016');
    expect(NorwegianOrgNumber.normalize(undefined)).toBe('');
    expect(NorwegianOrgNumber.isValid('NO 923 609 016 MVA')).toBe(true);
  });

  it('builds the Norwegian VAT number', () => {
    expect(NorwegianOrgNumber.toVatNumber('923 609 016')).toBe('NO923609016MVA');
    expect(NorwegianOrgNumber.toVatNumber('NO923609016MVA')).toBe('NO923609016MVA');
  });

  it('exposes the Peppol scheme', () => {
    expect(NorwegianOrgNumber.PEPPOL_SCHEME).toBe('0192');
  });
});

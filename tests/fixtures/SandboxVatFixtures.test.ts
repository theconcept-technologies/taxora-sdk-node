import { describe, it, expect } from 'vitest';
import { SandboxVatFixtures } from './SandboxVatFixtures.js';
import { VatResource } from '../../src/dto/VatResource.js';
import { VatState } from '../../src/enums/VatState.js';

describe('SandboxVatFixtures', () => {
  it('valid() returns 5 fixtures that hydrate VatResource', () => {
    const fixtures = SandboxVatFixtures.valid();
    expect(fixtures).toHaveLength(5);

    for (const fixture of fixtures) {
      const vat = VatResource.fromArray({
        vat_uid: fixture.vatUid,
        state: VatState.VALID,
        company_name: fixture.companyName,
      });
      expect(vat.vatUid).toBe(fixture.vatUid);
      expect(vat.state).toBe(VatState.VALID);
    }
  });

  it('invalid() returns 5 invalid VAT UIDs', () => {
    const invalid = SandboxVatFixtures.invalid();
    expect(invalid).toHaveLength(5);

    for (const vatUid of invalid) {
      const vat = VatResource.fromArray({ vat_uid: vatUid, state: VatState.INVALID });
      expect(vat.state).toBe(VatState.INVALID);
    }
  });

  it('byState() groups fixtures by VatState', () => {
    const byState = SandboxVatFixtures.byState();
    expect(byState[VatState.VALID]).toBeDefined();
    expect(byState[VatState.INVALID]).toBeDefined();
  });
});

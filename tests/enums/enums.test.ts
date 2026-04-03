import { describe, it, expect } from 'vitest';
import { Environment, getBaseUrl } from '../../src/enums/Environment.js';
import { ApiVersion } from '../../src/enums/ApiVersion.js';
import { Language } from '../../src/enums/Language.js';
import { LoginIdentifier } from '../../src/enums/LoginIdentifier.js';
import { VatState, getFailedVatStates, describeVatState } from '../../src/enums/VatState.js';

describe('Environment', () => {
  it('has SANDBOX and PRODUCTION values', () => {
    expect(Environment.SANDBOX).toBe('sandbox');
    expect(Environment.PRODUCTION).toBe('production');
  });

  it('getBaseUrl returns correct URLs', () => {
    expect(getBaseUrl(Environment.SANDBOX)).toBe('https://sandbox.taxora.io/v1');
    expect(getBaseUrl(Environment.PRODUCTION)).toBe('https://api.taxora.io/v1');
  });
});

describe('ApiVersion', () => {
  it('has V1 value', () => {
    expect(ApiVersion.V1).toBe('v1');
  });
});

describe('Language', () => {
  it('has ENGLISH and GERMAN values', () => {
    expect(Language.ENGLISH).toBe('en');
    expect(Language.GERMAN).toBe('de');
  });
});

describe('LoginIdentifier', () => {
  it('has EMAIL and CLIENT_ID values', () => {
    expect(LoginIdentifier.EMAIL).toBe('email');
    expect(LoginIdentifier.CLIENT_ID).toBe('client_id');
  });
});

describe('VatState', () => {
  it('has correct values', () => {
    expect(VatState.VALID).toBe('valid');
    expect(VatState.INVALID).toBe('invalid');
    expect(VatState.FRAUD).toBe('fraud');
    expect(VatState.UNKNOWN).toBe('unknown');
  });

  it('getFailedVatStates returns INVALID and FRAUD', () => {
    const failed = getFailedVatStates();
    expect(failed).toContain(VatState.INVALID);
    expect(failed).toContain(VatState.FRAUD);
    expect(failed).not.toContain(VatState.VALID);
    expect(failed).not.toContain(VatState.UNKNOWN);
  });

  it('describeVatState returns human-readable description for each state', () => {
    expect(describeVatState(VatState.VALID)).toBeTypeOf('string');
    expect(describeVatState(VatState.INVALID)).toBeTypeOf('string');
    expect(describeVatState(VatState.FRAUD)).toBeTypeOf('string');
    expect(describeVatState(VatState.UNKNOWN)).toBeTypeOf('string');
    expect(describeVatState(VatState.VALID).length).toBeGreaterThan(0);
  });
});

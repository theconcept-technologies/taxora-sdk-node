import { describe, it, expect } from 'vitest';
import { Environment, getBaseUrl } from '../../src/enums/Environment.js';
import { ApiVersion } from '../../src/enums/ApiVersion.js';
import { Language } from '../../src/enums/Language.js';
import { LoginIdentifier } from '../../src/enums/LoginIdentifier.js';
import { VatState, getFailedVatStates, describeVatState } from '../../src/enums/VatState.js';
import {
  ComplianceEnrollmentStatus,
  toComplianceEnrollmentStatus,
  describeComplianceEnrollmentStatus,
} from '../../src/enums/ComplianceEnrollmentStatus.js';
import {
  ComplianceTransactionState,
  toComplianceTransactionState,
  describeComplianceTransactionState,
} from '../../src/enums/ComplianceTransactionState.js';
import {
  ComplianceTransactionType,
  toComplianceTransactionType,
  describeComplianceTransactionType,
} from '../../src/enums/ComplianceTransactionType.js';
import {
  ComplianceTaxReportState,
  toComplianceTaxReportState,
  describeComplianceTaxReportState,
} from '../../src/enums/ComplianceTaxReportState.js';

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

describe('ComplianceEnrollmentStatus', () => {
  it('has all backend values', () => {
    expect(Object.values(ComplianceEnrollmentStatus)).toEqual([
      'pending_data',
      'account_created',
      'regime_activated',
      'ready',
      'suspended',
      'error_account',
      'error_activation',
      'unknown',
    ]);
  });

  it('toComplianceEnrollmentStatus coerces tolerantly', () => {
    expect(toComplianceEnrollmentStatus('ready')).toBe(ComplianceEnrollmentStatus.READY);
    expect(toComplianceEnrollmentStatus('  Regime_Activated ')).toBe(ComplianceEnrollmentStatus.REGIME_ACTIVATED);
    expect(toComplianceEnrollmentStatus('exploded')).toBe(ComplianceEnrollmentStatus.UNKNOWN);
    expect(toComplianceEnrollmentStatus(null)).toBe(ComplianceEnrollmentStatus.UNKNOWN);
    expect(toComplianceEnrollmentStatus(42)).toBe(ComplianceEnrollmentStatus.UNKNOWN);
  });

  it('describeComplianceEnrollmentStatus returns a description for every value', () => {
    for (const status of Object.values(ComplianceEnrollmentStatus)) {
      expect(describeComplianceEnrollmentStatus(status).length).toBeGreaterThan(0);
    }
  });
});

describe('ComplianceTransactionState', () => {
  it('has all backend values', () => {
    expect(Object.values(ComplianceTransactionState)).toEqual(['pending', 'sending', 'submitted', 'error', 'unknown']);
  });

  it('toComplianceTransactionState coerces tolerantly', () => {
    expect(toComplianceTransactionState('submitted')).toBe(ComplianceTransactionState.SUBMITTED);
    expect(toComplianceTransactionState(' PENDING ')).toBe(ComplianceTransactionState.PENDING);
    expect(toComplianceTransactionState('teleporting')).toBe(ComplianceTransactionState.UNKNOWN);
    expect(toComplianceTransactionState(undefined)).toBe(ComplianceTransactionState.UNKNOWN);
  });

  it('describeComplianceTransactionState returns a description for every value', () => {
    for (const state of Object.values(ComplianceTransactionState)) {
      expect(describeComplianceTransactionState(state).length).toBeGreaterThan(0);
    }
  });
});

describe('ComplianceTransactionType', () => {
  it('has all backend values', () => {
    expect(Object.values(ComplianceTransactionType)).toEqual([
      'b2c_outbound',
      'b2b_domestic_outbound',
      'b2b_domestic_inbound',
      'crossborder_outbound',
      'crossborder_inbound',
      'unknown',
    ]);
  });

  it('toComplianceTransactionType coerces tolerantly', () => {
    expect(toComplianceTransactionType('b2c_outbound')).toBe(ComplianceTransactionType.B2C_OUTBOUND);
    expect(toComplianceTransactionType(' Crossborder_Inbound ')).toBe(ComplianceTransactionType.CROSSBORDER_INBOUND);
    expect(toComplianceTransactionType('b2x_sideways')).toBe(ComplianceTransactionType.UNKNOWN);
    expect(toComplianceTransactionType({})).toBe(ComplianceTransactionType.UNKNOWN);
  });

  it('describeComplianceTransactionType returns a description for every value', () => {
    for (const type of Object.values(ComplianceTransactionType)) {
      expect(describeComplianceTransactionType(type).length).toBeGreaterThan(0);
    }
  });
});

describe('ComplianceTaxReportState', () => {
  it('has all backend values', () => {
    expect(Object.values(ComplianceTaxReportState)).toEqual([
      'new',
      'sent',
      'acknowledged',
      'registered',
      'refused',
      'error',
      'unknown',
    ]);
  });

  it('toComplianceTaxReportState coerces tolerantly', () => {
    expect(toComplianceTaxReportState('registered')).toBe(ComplianceTaxReportState.REGISTERED);
    expect(toComplianceTaxReportState(' Refused ')).toBe(ComplianceTaxReportState.REFUSED);
    expect(toComplianceTaxReportState('vaporized')).toBe(ComplianceTaxReportState.UNKNOWN);
    expect(toComplianceTaxReportState([])).toBe(ComplianceTaxReportState.UNKNOWN);
  });

  it('describeComplianceTaxReportState returns a description for every value', () => {
    for (const state of Object.values(ComplianceTaxReportState)) {
      expect(describeComplianceTaxReportState(state).length).toBeGreaterThan(0);
    }
  });
});

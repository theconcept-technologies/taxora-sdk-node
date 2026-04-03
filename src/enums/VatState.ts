export const VatState = {
  VALID: 'valid',
  INVALID: 'invalid',
  FRAUD: 'fraud',
  UNKNOWN: 'unknown',
} as const;

export type VatState = (typeof VatState)[keyof typeof VatState];

export function getFailedVatStates(): VatState[] {
  return [VatState.INVALID, VatState.FRAUD];
}

const DESCRIPTIONS: Record<VatState, string> = {
  [VatState.VALID]: 'The VAT number is valid and active.',
  [VatState.INVALID]: 'The VAT number is invalid or not registered.',
  [VatState.FRAUD]: 'The VAT number has been flagged as potentially fraudulent.',
  [VatState.UNKNOWN]: 'The VAT number state could not be determined.',
};

export function describeVatState(state: VatState): string {
  return DESCRIPTIONS[state];
}

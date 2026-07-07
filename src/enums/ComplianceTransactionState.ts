export const ComplianceTransactionState = {
  PENDING: 'pending',
  SENDING: 'sending',
  SUBMITTED: 'submitted',
  ERROR: 'error',
  UNKNOWN: 'unknown',
} as const;

export type ComplianceTransactionState = (typeof ComplianceTransactionState)[keyof typeof ComplianceTransactionState];

const VALUES: readonly string[] = Object.values(ComplianceTransactionState);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toComplianceTransactionState(value: unknown): ComplianceTransactionState {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as ComplianceTransactionState;
    }
  }
  return ComplianceTransactionState.UNKNOWN;
}

const DESCRIPTIONS: Record<ComplianceTransactionState, string> = {
  [ComplianceTransactionState.PENDING]: 'Recorded locally, not yet submitted to the provider.',
  [ComplianceTransactionState.SENDING]: 'Submission to the provider in progress.',
  [ComplianceTransactionState.SUBMITTED]: 'Successfully submitted to the provider.',
  [ComplianceTransactionState.ERROR]: 'Submission failed. See submissionError.',
  [ComplianceTransactionState.UNKNOWN]: 'Unknown state.',
};

export function describeComplianceTransactionState(state: ComplianceTransactionState): string {
  return DESCRIPTIONS[state];
}

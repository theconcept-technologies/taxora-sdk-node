export const ComplianceEnrollmentStatus = {
  PENDING_DATA: 'pending_data',
  ACCOUNT_CREATED: 'account_created',
  REGIME_ACTIVATED: 'regime_activated',
  READY: 'ready',
  SUSPENDED: 'suspended',
  ERROR_ACCOUNT: 'error_account',
  ERROR_ACTIVATION: 'error_activation',
  UNKNOWN: 'unknown',
} as const;

export type ComplianceEnrollmentStatus = (typeof ComplianceEnrollmentStatus)[keyof typeof ComplianceEnrollmentStatus];

const VALUES: readonly string[] = Object.values(ComplianceEnrollmentStatus);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toComplianceEnrollmentStatus(value: unknown): ComplianceEnrollmentStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as ComplianceEnrollmentStatus;
    }
  }
  return ComplianceEnrollmentStatus.UNKNOWN;
}

const DESCRIPTIONS: Record<ComplianceEnrollmentStatus, string> = {
  [ComplianceEnrollmentStatus.PENDING_DATA]: 'Awaiting merchant data before provisioning can start.',
  [ComplianceEnrollmentStatus.ACCOUNT_CREATED]: 'Provider account exists. Regime not yet activated.',
  [ComplianceEnrollmentStatus.REGIME_ACTIVATED]:
    'Compliance regime activated at provider. Ready to submit transactions.',
  [ComplianceEnrollmentStatus.READY]: 'Enrollment fully active and reporting.',
  [ComplianceEnrollmentStatus.SUSPENDED]: 'Enrollment temporarily suspended.',
  [ComplianceEnrollmentStatus.ERROR_ACCOUNT]: 'Provider account creation failed.',
  [ComplianceEnrollmentStatus.ERROR_ACTIVATION]: 'Regime activation at provider failed.',
  [ComplianceEnrollmentStatus.UNKNOWN]: 'Unknown status.',
};

export function describeComplianceEnrollmentStatus(status: ComplianceEnrollmentStatus): string {
  return DESCRIPTIONS[status];
}

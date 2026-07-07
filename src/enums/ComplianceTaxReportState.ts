export const ComplianceTaxReportState = {
  NEW: 'new',
  SENT: 'sent',
  ACKNOWLEDGED: 'acknowledged',
  REGISTERED: 'registered',
  REFUSED: 'refused',
  ERROR: 'error',
  UNKNOWN: 'unknown',
} as const;

export type ComplianceTaxReportState = (typeof ComplianceTaxReportState)[keyof typeof ComplianceTaxReportState];

const VALUES: readonly string[] = Object.values(ComplianceTaxReportState);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toComplianceTaxReportState(value: unknown): ComplianceTaxReportState {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as ComplianceTaxReportState;
    }
  }
  return ComplianceTaxReportState.UNKNOWN;
}

const DESCRIPTIONS: Record<ComplianceTaxReportState, string> = {
  [ComplianceTaxReportState.NEW]: 'Created at provider, waiting for the daily ledger batch.',
  [ComplianceTaxReportState.SENT]: 'Ledger transmitted to PPF.',
  [ComplianceTaxReportState.ACKNOWLEDGED]: 'PPF acknowledged receipt of the ledger.',
  [ComplianceTaxReportState.REGISTERED]: 'Accepted by DGFiP (CDV 300).',
  [ComplianceTaxReportState.REFUSED]: 'Rejected by DGFiP (CDV 301).',
  [ComplianceTaxReportState.ERROR]: 'Transmission or PPF error.',
  [ComplianceTaxReportState.UNKNOWN]: 'Unknown state.',
};

export function describeComplianceTaxReportState(state: ComplianceTaxReportState): string {
  return DESCRIPTIONS[state];
}

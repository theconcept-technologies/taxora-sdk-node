export const ComplianceTransactionType = {
  B2C_OUTBOUND: 'b2c_outbound',
  B2B_DOMESTIC_OUTBOUND: 'b2b_domestic_outbound',
  B2B_DOMESTIC_INBOUND: 'b2b_domestic_inbound',
  CROSSBORDER_OUTBOUND: 'crossborder_outbound',
  CROSSBORDER_INBOUND: 'crossborder_inbound',
  UNKNOWN: 'unknown',
} as const;

export type ComplianceTransactionType = (typeof ComplianceTransactionType)[keyof typeof ComplianceTransactionType];

const VALUES: readonly string[] = Object.values(ComplianceTransactionType);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toComplianceTransactionType(value: unknown): ComplianceTransactionType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as ComplianceTransactionType;
    }
  }
  return ComplianceTransactionType.UNKNOWN;
}

const DESCRIPTIONS: Record<ComplianceTransactionType, string> = {
  [ComplianceTransactionType.B2C_OUTBOUND]: 'Sale to a private person in the merchant country (DGFiP Flux 10.3).',
  [ComplianceTransactionType.B2B_DOMESTIC_OUTBOUND]: 'Sale to a domestic business (DGFiP Flux 1, Phase 2).',
  [ComplianceTransactionType.B2B_DOMESTIC_INBOUND]: 'Purchase from a domestic business (DGFiP Flux 1, Phase 2).',
  [ComplianceTransactionType.CROSSBORDER_OUTBOUND]: 'Sale to a non-domestic business (DGFiP Flux 10.1).',
  [ComplianceTransactionType.CROSSBORDER_INBOUND]: 'Purchase from a non-domestic supplier (DGFiP Flux 10.1).',
  [ComplianceTransactionType.UNKNOWN]: 'Unknown transaction type.',
};

export function describeComplianceTransactionType(type: ComplianceTransactionType): string {
  return DESCRIPTIONS[type];
}

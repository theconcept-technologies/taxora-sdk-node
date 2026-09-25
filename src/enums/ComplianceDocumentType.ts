/** Kind of document a compliance transaction represents. */
export const ComplianceDocumentType = {
  INVOICE: 'invoice',
  CREDIT_NOTE: 'credit_note',
  UNKNOWN: 'unknown',
} as const;

export type ComplianceDocumentType = (typeof ComplianceDocumentType)[keyof typeof ComplianceDocumentType];

const VALUES: readonly string[] = Object.values(ComplianceDocumentType);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toComplianceDocumentType(value: unknown): ComplianceDocumentType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as ComplianceDocumentType;
    }
  }
  return ComplianceDocumentType.UNKNOWN;
}

const DESCRIPTIONS: Record<ComplianceDocumentType, string> = {
  [ComplianceDocumentType.INVOICE]: 'Commercial invoice.',
  [ComplianceDocumentType.CREDIT_NOTE]: 'Credit note correcting a previously issued invoice.',
  [ComplianceDocumentType.UNKNOWN]: 'Unknown document type.',
};

export function describeComplianceDocumentType(type: ComplianceDocumentType): string {
  return DESCRIPTIONS[type];
}

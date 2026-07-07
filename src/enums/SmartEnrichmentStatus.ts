export const SmartEnrichmentStatus = {
  FOUND: 'found',
  NO_VAT_EXISTS: 'no_vat_exists',
  NOT_FOUND: 'not_found',
  PROCESSING: 'processing',
  QUEUED: 'queued',
  COMPLETED: 'completed',
  FAILED: 'failed',
  UNKNOWN: 'unknown',
} as const;

export type SmartEnrichmentStatus = (typeof SmartEnrichmentStatus)[keyof typeof SmartEnrichmentStatus];

const VALUES: readonly string[] = Object.values(SmartEnrichmentStatus);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toSmartEnrichmentStatus(value: unknown): SmartEnrichmentStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as SmartEnrichmentStatus;
    }
  }
  return SmartEnrichmentStatus.UNKNOWN;
}

const DESCRIPTIONS: Record<SmartEnrichmentStatus, string> = {
  [SmartEnrichmentStatus.FOUND]: 'A VAT number was resolved and confirmed.',
  [SmartEnrichmentStatus.NO_VAT_EXISTS]: 'The company was identified but has no VAT number.',
  [SmartEnrichmentStatus.NOT_FOUND]: 'No sufficiently-confident match could be resolved.',
  [SmartEnrichmentStatus.PROCESSING]: 'The lookup is still being processed.',
  [SmartEnrichmentStatus.QUEUED]: 'The job is queued.',
  [SmartEnrichmentStatus.COMPLETED]: 'The job has completed.',
  [SmartEnrichmentStatus.FAILED]: 'The job failed.',
  [SmartEnrichmentStatus.UNKNOWN]: 'Unknown status.',
};

export function describeSmartEnrichmentStatus(status: SmartEnrichmentStatus): string {
  return DESCRIPTIONS[status];
}

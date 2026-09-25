/**
 * Outcome of a Peppol directory lookup (GET /compliance/peppol-lookup). The
 * directory resolves asynchronously — `pending` means ask again in a few seconds.
 */
export const PeppolLookupStatus = {
  REACHABLE: 'reachable',
  NOT_REACHABLE: 'not_reachable',
  PENDING: 'pending',
  UNKNOWN: 'unknown',
} as const;

export type PeppolLookupStatus = (typeof PeppolLookupStatus)[keyof typeof PeppolLookupStatus];

const VALUES: readonly string[] = Object.values(PeppolLookupStatus);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toPeppolLookupStatus(value: unknown): PeppolLookupStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as PeppolLookupStatus;
    }
  }
  return PeppolLookupStatus.UNKNOWN;
}

const DESCRIPTIONS: Record<PeppolLookupStatus, string> = {
  [PeppolLookupStatus.REACHABLE]: 'The participant is registered on Peppol and can receive e-invoices.',
  [PeppolLookupStatus.NOT_REACHABLE]: 'The participant is not registered on Peppol.',
  [PeppolLookupStatus.PENDING]: 'The directory lookup is still resolving — ask again in a few seconds.',
  [PeppolLookupStatus.UNKNOWN]: 'Unknown lookup status.',
};

export function describePeppolLookupStatus(status: PeppolLookupStatus): string {
  return DESCRIPTIONS[status];
}

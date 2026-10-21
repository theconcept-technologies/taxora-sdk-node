/**
 * Why a VAT number the research DID find was not returned as the result.
 *
 * Only appears on `not_found` results (see `SmartEnrichmentResource.rejectedCandidates`), so
 * "a number was found, but the tax authority calls it invalid" can be told apart from "nothing
 * was found at all".
 */
export const SmartEnrichmentRejectionReason = {
  /** The tax authority reports the number as not (or no longer) valid. */
  VAT_INVALID: 'vat_invalid',
  /** The number is valid, but registered to a different company. */
  NAME_MISMATCH: 'name_mismatch',
  /** The number could not be tied to the requested company. */
  UNBOUND: 'unbound',
  /** The number could not be checked against the tax authority. */
  UNVERIFIED: 'unverified',
  /** Rejected for another reason. */
  REJECTED: 'rejected',
  /** A reason this SDK version does not know yet. */
  UNKNOWN: 'unknown',
} as const;

export type SmartEnrichmentRejectionReason =
  (typeof SmartEnrichmentRejectionReason)[keyof typeof SmartEnrichmentRejectionReason];

const VALUES: readonly string[] = Object.values(SmartEnrichmentRejectionReason);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toSmartEnrichmentRejectionReason(value: unknown): SmartEnrichmentRejectionReason {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as SmartEnrichmentRejectionReason;
    }
  }
  return SmartEnrichmentRejectionReason.UNKNOWN;
}

const DESCRIPTIONS: Record<SmartEnrichmentRejectionReason, string> = {
  [SmartEnrichmentRejectionReason.VAT_INVALID]: 'The tax authority reports the VAT number as invalid.',
  [SmartEnrichmentRejectionReason.NAME_MISMATCH]: 'The VAT number is registered to a different company.',
  [SmartEnrichmentRejectionReason.UNBOUND]: 'The VAT number could not be tied to the requested company.',
  [SmartEnrichmentRejectionReason.UNVERIFIED]: 'The VAT number could not be verified with the tax authority.',
  [SmartEnrichmentRejectionReason.REJECTED]: 'The VAT number was not confirmed.',
  [SmartEnrichmentRejectionReason.UNKNOWN]: 'Unknown rejection reason.',
};

export function describeSmartEnrichmentRejectionReason(reason: SmartEnrichmentRejectionReason): string {
  return DESCRIPTIONS[reason];
}

/**
 * How hard a Smart Enrichment lookup is allowed to search.
 *
 * `default` searches with one AI provider and consults a second one only when the first finds
 * nothing — one paid search per lookup in the common case.
 *
 * `complex` has two independent AI providers search from the start, and every VAT number either of
 * them proposes is put through the tax authority's checks until one confirms. Noticeably better on
 * hard lookups — companies whose VAT only appears in a website Impressum — and it costs more per
 * lookup, so it is opt-in per request rather than the default.
 */
export const SmartEnrichmentMode = {
  DEFAULT: 'default',
  COMPLEX: 'complex',
} as const;

export type SmartEnrichmentMode = (typeof SmartEnrichmentMode)[keyof typeof SmartEnrichmentMode];

const VALUES: readonly string[] = Object.values(SmartEnrichmentMode);

/**
 * Coercion for values coming back from the API. Returns undefined for anything unrecognized —
 * unlike the status enum there is no `unknown` member to fall back to, and inventing a mode would
 * misreport how a lookup actually ran.
 */
export function toSmartEnrichmentMode(value: unknown): SmartEnrichmentMode | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as SmartEnrichmentMode;
    }
  }
  return undefined;
}

const DESCRIPTIONS: Record<SmartEnrichmentMode, string> = {
  [SmartEnrichmentMode.DEFAULT]: 'One provider searches; a second is consulted only if it finds nothing.',
  [SmartEnrichmentMode.COMPLEX]:
    'Two providers search independently and are cross-checked against the tax authority. Costs more.',
};

export function describeSmartEnrichmentMode(mode: SmartEnrichmentMode): string {
  return DESCRIPTIONS[mode];
}

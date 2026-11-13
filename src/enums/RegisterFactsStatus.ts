/** Outcome of `vat.registerFacts()` — what the official commercial register lookup gave. */
export const RegisterFactsStatus = {
  /** The register has something to tell: see `note` and `announcements`. */
  FOUND: 'found',
  /** The register was asked and has nothing relevant on this company. */
  EMPTY: 'empty',
  /** The register could not be reached; retry with `{ refresh: true }` (`canRetry`). */
  ERROR: 'error',
  /** Nothing cached yet and `fetch` was not requested — call again with `{ fetch: true }`. */
  NOT_CHECKED: 'not_checked',
  /** No register source for this country (or the sandbox). */
  UNAVAILABLE: 'unavailable',
  /** A status this SDK version does not know yet. */
  UNKNOWN: 'unknown',
} as const;

export type RegisterFactsStatus = (typeof RegisterFactsStatus)[keyof typeof RegisterFactsStatus];

const VALUES: readonly string[] = Object.values(RegisterFactsStatus);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toRegisterFactsStatus(value: unknown): RegisterFactsStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as RegisterFactsStatus;
    }
  }
  return RegisterFactsStatus.UNKNOWN;
}

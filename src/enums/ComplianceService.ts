/**
 * The compliance service an enrollment books for its country: French DGFiP
 * e-reporting, or e-invoicing (e.g. Norway EHF / Peppol BIS 3.0). Each country
 * and service is unlocked and billed separately.
 */
export const ComplianceService = {
  E_REPORTING: 'e_reporting',
  E_INVOICING: 'e_invoicing',
  UNKNOWN: 'unknown',
} as const;

export type ComplianceService = (typeof ComplianceService)[keyof typeof ComplianceService];

const VALUES: readonly string[] = Object.values(ComplianceService);

/** Tolerant coercion: unrecognized values become `unknown` instead of throwing. */
export function toComplianceService(value: unknown): ComplianceService {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALUES.includes(normalized)) {
      return normalized as ComplianceService;
    }
  }
  return ComplianceService.UNKNOWN;
}

const DESCRIPTIONS: Record<ComplianceService, string> = {
  [ComplianceService.E_REPORTING]: 'E-reporting of transaction data to the tax authority (France: DGFiP Flux 10).',
  [ComplianceService.E_INVOICING]: 'Structured e-invoices delivered to the buyer (Norway: EHF / Peppol BIS 3.0).',
  [ComplianceService.UNKNOWN]: 'Unknown service.',
};

export function describeComplianceService(service: ComplianceService): string {
  return DESCRIPTIONS[service];
}

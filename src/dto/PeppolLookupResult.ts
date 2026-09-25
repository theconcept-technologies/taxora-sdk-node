import {
  type PeppolLookupStatus,
  PeppolLookupStatus as Status,
  toPeppolLookupStatus,
} from '../enums/PeppolLookupStatus.js';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Whether a participant can receive e-invoices over Peppol
 * (GET /compliance/peppol-lookup). For Norway, `reachable === true` means the
 * buyer is registered in ELMA and must receive an EHF e-invoice.
 */
export class PeppolLookupResult {
  constructor(
    public readonly status: PeppolLookupStatus,
    /** null while the lookup is still `pending`. */
    public readonly reachable: boolean | null,
    public readonly country: string,
    /** Peppol identifier scheme, e.g. "0192" for Norwegian organisation numbers. */
    public readonly scheme: string,
    /** Participant identifier, e.g. the organisation number. */
    public readonly id: string,
    /** Peppol document types the participant accepts, e.g. "xml.ubl.invoice.bis3". */
    public readonly documentTypes: string[],
    public readonly transportTypeCode: string | null,
    public readonly checkedAt: string | null,
  ) {}

  /** True while the directory is still resolving — ask again in a few seconds. */
  get isPending(): boolean {
    return this.status === Status.PENDING;
  }

  static fromArray(data: Record<string, unknown>): PeppolLookupResult {
    const documentTypes = Array.isArray(data['document_types'])
      ? (data['document_types'] as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];

    return new PeppolLookupResult(
      toPeppolLookupStatus(data['status']),
      typeof data['reachable'] === 'boolean' ? data['reachable'] : null,
      asString(data['country']),
      asString(data['scheme']),
      asString(data['id']),
      documentTypes,
      asNullableString(data['transport_type_code']),
      asNullableString(data['checked_at']),
    );
  }
}

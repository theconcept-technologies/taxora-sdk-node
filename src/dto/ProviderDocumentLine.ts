export class ProviderDocumentLine {
  constructor(
    public readonly id: number | null,
    public readonly vatUid: string | null,
    public readonly rowNumber: number | null,
    public readonly entryIdentifier: string | null,
    public readonly reference: string | null,
    public readonly meta: Record<string, unknown>,
  ) {}

  static fromArray(data: unknown): ProviderDocumentLine | null {
    if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }
    const d = data as Record<string, unknown>;

    return new ProviderDocumentLine(
      typeof d['id'] === 'number' ? d['id'] : null,
      typeof d['vat_uid'] === 'string' ? d['vat_uid'] : null,
      typeof d['row_number'] === 'number' ? d['row_number'] : null,
      typeof d['entry_identifier'] === 'string' ? d['entry_identifier'] : null,
      typeof d['reference'] === 'string' ? d['reference'] : null,
      d['meta'] !== null && typeof d['meta'] === 'object' && !Array.isArray(d['meta'])
        ? (d['meta'] as Record<string, unknown>)
        : {},
    );
  }

  toArray(): Record<string, unknown> {
    return {
      id: this.id,
      vat_uid: this.vatUid,
      row_number: this.rowNumber,
      entry_identifier: this.entryIdentifier,
      reference: this.reference,
      meta: this.meta,
    };
  }
}

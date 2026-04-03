import { ProviderDocumentLine } from './ProviderDocumentLine.js';

export class ProviderDocument {
  constructor(
    public readonly id: number | null,
    public readonly provider: string | null,
    public readonly documentType: string | null,
    public readonly state: string | null,
    public readonly documentDate: Date | null,
    public readonly mime: string | null,
    public readonly size: number | null,
    public readonly hash: string | null,
    public readonly meta: Record<string, unknown>,
    public readonly line: ProviderDocumentLine | null,
  ) {}

  static fromArray(data: unknown): ProviderDocument | null {
    if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }
    const d = data as Record<string, unknown>;

    const documentDate =
      typeof d['document_date'] === 'string' && d['document_date'] ? new Date(d['document_date']) : null;

    return new ProviderDocument(
      typeof d['id'] === 'number' ? d['id'] : null,
      typeof d['provider'] === 'string' ? d['provider'] : null,
      typeof d['document_type'] === 'string' ? d['document_type'] : null,
      typeof d['state'] === 'string' ? d['state'] : null,
      documentDate,
      typeof d['mime'] === 'string' ? d['mime'] : null,
      typeof d['size'] === 'number' ? d['size'] : null,
      typeof d['hash'] === 'string' ? d['hash'] : null,
      d['meta'] !== null && typeof d['meta'] === 'object' && !Array.isArray(d['meta'])
        ? (d['meta'] as Record<string, unknown>)
        : {},
      ProviderDocumentLine.fromArray(d['line']),
    );
  }

  toArray(): Record<string, unknown> {
    return {
      id: this.id,
      provider: this.provider,
      document_type: this.documentType,
      state: this.state,
      document_date: this.documentDate?.toISOString() ?? null,
      mime: this.mime,
      size: this.size,
      hash: this.hash,
      meta: this.meta,
      line: this.line?.toArray() ?? null,
    };
  }
}

import { type SmartEnrichmentStatus, toSmartEnrichmentStatus } from '../enums/SmartEnrichmentStatus.js';

/**
 * Result of resolving one reverse-VAT lookup (company name + address → VAT + confidence).
 * Mirrors the API response item shape (camelCase keys).
 */
export class SmartEnrichmentResource {
  constructor(
    public readonly status: SmartEnrichmentStatus,
    public readonly vatNumber: string | undefined,
    public readonly vatType: string | undefined,
    public readonly confidence: number | undefined,
    public readonly matchedCompanyName: string | undefined,
    /** Official/registered address of the matched company, when available. */
    public readonly matchedAddress: string | undefined,
    public readonly country: string | undefined,
    public readonly source: string | undefined,
  ) {}

  static fromArray(data: Record<string, unknown>): SmartEnrichmentResource {
    const str = (key: string): string | undefined => {
      const v = data[key];
      return typeof v === 'string' ? v : undefined;
    };
    const num = (key: string): number | undefined => {
      const v = data[key];
      return typeof v === 'number' ? v : undefined;
    };

    return new SmartEnrichmentResource(
      toSmartEnrichmentStatus(data['status']),
      str('vatNumber'),
      str('vatType'),
      num('confidence'),
      str('matchedCompanyName'),
      str('matchedAddress'),
      str('country'),
      str('source'),
    );
  }

  toArray(): Record<string, unknown> {
    return {
      status: this.status,
      vatNumber: this.vatNumber ?? null,
      vatType: this.vatType ?? null,
      confidence: this.confidence ?? null,
      matchedCompanyName: this.matchedCompanyName ?? null,
      matchedAddress: this.matchedAddress ?? null,
      country: this.country ?? null,
      source: this.source ?? null,
    };
  }
}

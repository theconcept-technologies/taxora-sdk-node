import { type SmartEnrichmentMode, toSmartEnrichmentMode } from '../enums/SmartEnrichmentMode.js';
import { type SmartEnrichmentStatus, toSmartEnrichmentStatus } from '../enums/SmartEnrichmentStatus.js';

/** What one AI provider independently concluded, when more than one searched. */
export interface SmartEnrichmentProviderVerdict {
  provider: string;
  model: string | null;
  status: string;
  vatNumber: string | null;
  confidence: number | null;
  /** False when the model answered from memory instead of an actual web search. */
  grounded: boolean;
  sourceUrl: string | null;
}

/**
 * What the API made of the address you submitted. The actionable part is `warnings`:
 * `postal_code_city_mismatch` / `postal_code_unassigned` / `postal_code_format_invalid` mean the
 * postal code in your source record is wrong, and `derivedPlace` is where it actually points —
 * worth writing back into your own data.
 */
export interface SmartEnrichmentAddressQuality {
  providedPostalCode: string | null;
  providedCity: string | null;
  postalCodeFormatValid: boolean | null;
  postalCodeAssigned: boolean | null;
  /** False when the postal code was excluded from the search because it could not be trusted. */
  postalCodeTrusted: boolean;
  derivedPlace: string | null;
  cityMatchesPostalCode: boolean | null;
  warnings: string[];
}

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
    /** The search mode this lookup actually ran in. */
    public readonly mode: SmartEnrichmentMode | undefined = undefined,
    /**
     * What each AI provider independently concluded. Populated when more than one searched
     * (complex mode, or a fallback). Two entries reporting the same vatNumber is the strongest
     * confirmation this layer produces.
     */
    public readonly providerVerdicts: SmartEnrichmentProviderVerdict[] = [],
    public readonly addressQuality: SmartEnrichmentAddressQuality | undefined = undefined,
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

    const verdicts = data['providerVerdicts'];
    const quality = data['addressQuality'];

    return new SmartEnrichmentResource(
      toSmartEnrichmentStatus(data['status']),
      str('vatNumber'),
      str('vatType'),
      num('confidence'),
      str('matchedCompanyName'),
      str('matchedAddress'),
      str('country'),
      str('source'),
      toSmartEnrichmentMode(data['mode']),
      Array.isArray(verdicts)
        ? (verdicts.filter((v) => typeof v === 'object' && v !== null) as SmartEnrichmentProviderVerdict[])
        : [],
      typeof quality === 'object' && quality !== null
        ? (quality as SmartEnrichmentAddressQuality)
        : undefined,
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
      mode: this.mode ?? null,
      providerVerdicts: this.providerVerdicts,
      addressQuality: this.addressQuality ?? null,
    };
  }
}

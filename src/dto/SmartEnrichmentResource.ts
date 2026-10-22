import { type SmartEnrichmentMode, toSmartEnrichmentMode } from '../enums/SmartEnrichmentMode.js';
import {
  type SmartEnrichmentRejectionReason,
  toSmartEnrichmentRejectionReason,
} from '../enums/SmartEnrichmentRejectionReason.js';
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

/** A VAT number the research named, but the official check threw out. */
export interface SmartEnrichmentRejectedCandidate {
  vatNumber: string;
  reason: SmartEnrichmentRejectionReason;
}

function toRejectedCandidates(value: unknown): SmartEnrichmentRejectedCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const candidates: SmartEnrichmentRejectedCandidate[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const vatNumber = typeof record['vatNumber'] === 'string' ? record['vatNumber'].trim() : '';
    // An entry without a number carries nothing to report.
    if (vatNumber === '') {
      continue;
    }
    candidates.push({ vatNumber, reason: toSmartEnrichmentRejectionReason(record['reason']) });
  }
  return candidates;
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
    /**
     * Only on `not_found`: VAT numbers the research DID find but the official check threw out —
     * e.g. one the tax authority reports as invalid. Lets you tell "found one, it is invalid"
     * apart from "found nothing". Empty for every other status.
     */
    public readonly rejectedCandidates: SmartEnrichmentRejectedCandidate[] = [],
    /**
     * Only on `found`: the web page the VAT number was read from — usually the company's own
     * Impressum / legal notice. Undefined when it came from Taxora's own data or a register.
     */
    public readonly sourceUrl: string | undefined = undefined,
    /**
     * Only on `found`: the PERSON the tax authority has the VAT ID under, when that is not the
     * trading name — typical for a German sole proprietorship (e.K.). `matchedCompanyName` stays
     * the trading name.
     */
    public readonly registeredOwner: string | undefined = undefined,
    /**
     * Only on `found`: every page the VAT number was read from, `sourceUrl` first — each research
     * pass that found the same number contributes its page. At most 5.
     */
    public readonly sourceUrls: string[] = [],
  ) {}

  /** True when a VAT number was found but rejected by the official check. */
  hasRejectedCandidates(): boolean {
    return this.rejectedCandidates.length > 0;
  }

  static fromArray(data: Record<string, unknown>): SmartEnrichmentResource {
    const str = (key: string): string | undefined => {
      const v = data[key];
      return typeof v === 'string' ? v : undefined;
    };
    const text = (key: string): string | undefined => {
      const v = str(key)?.trim();
      return v ? v : undefined;
    };
    // Only an http(s) address — anything else in the field is not a link worth following.
    const isWebUrl = (value: unknown): value is string =>
      typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
    const url = text('sourceUrl');
    const urls = data['sourceUrls'];
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
      typeof quality === 'object' && quality !== null ? (quality as SmartEnrichmentAddressQuality) : undefined,
      toRejectedCandidates(data['rejectedCandidates']),
      url && isWebUrl(url) ? url : undefined,
      text('registeredOwner'),
      Array.isArray(urls) ? [...new Set(urls.filter(isWebUrl).map((u) => u.trim()))] : [],
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
      rejectedCandidates: this.rejectedCandidates.map((c) => ({ vatNumber: c.vatNumber, reason: c.reason })),
      sourceUrl: this.sourceUrl ?? null,
      registeredOwner: this.registeredOwner ?? null,
      sourceUrls: this.sourceUrls,
    };
  }
}

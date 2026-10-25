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

/** Where a Smart Enrichment `taxNumber` comes from. */
export type SmartEnrichmentTaxNumberSource = 'vat_id' | 'company_website';

/** The registered address the official VAT check returned, field by field. */
export interface SmartEnrichmentOfficialAddress {
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

function toOfficialAddress(value: unknown): SmartEnrichmentOfficialAddress | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const address: SmartEnrichmentOfficialAddress = {};
  for (const key of ['street', 'postal_code', 'city', 'country'] as const) {
    const part = typeof record[key] === 'string' ? (record[key] as string).trim() : '';
    if (part !== '') {
      address[key] = part;
    }
  }
  return Object.keys(address).length > 0 ? address : undefined;
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
    /**
     * The company's LOCAL tax / business number, national notation without spaces — what domestic
     * e-invoicing asks for. On `found` it is read off the confirmed VAT ID where that country's VAT ID
     * contains it (`taxNumberSource` 'vat_id': FR SIREN, IT Partita IVA, ES NIF, PL NIP, BE enterprise
     * number, DK CVR, PT, RO, CZ IČO, SK DIČ, SE/NO orgnr, FI Y-tunnus, SI, HR OIB, BG EIK, GR AFM).
     * Otherwise a domestic number the company itself published ('company_website', e.g. a DE/AT
     * Steuernummer) — that one is not a VAT ID.
     */
    public readonly taxNumber: string | undefined = undefined,
    /** Only on `found`: the tax authority's verdict on the number; undefined when no official check ran. */
    public readonly vatValid: boolean | undefined = undefined,
    /** Only on `found`: 0–100, the requested name against the register's; undefined when no name was disclosed. */
    public readonly aiScore: number | undefined = undefined,
    /**
     * Only on `found`: 'ok' (name matches the register) or 'mismatch' (it does not — another company,
     * unless `registeredOwner` is set: then update your record).
     */
    public readonly nameMatch: 'ok' | 'mismatch' | undefined = undefined,
    /** Only on `found`: the name the register has the number under. */
    public readonly officialName: string | undefined = undefined,
    /** Only on `found`: the registered address, field by field. */
    public readonly officialAddress: SmartEnrichmentOfficialAddress | undefined = undefined,
    /** What `taxNumber` is, e.g. 'pl_nip', 'fr_siren', 'de_steuernummer'. Undefined when there is none. */
    public readonly taxNumberType: string | undefined = undefined,
    /** The number's name in its country (SIREN, NIP, Steuernummer …), for display. */
    public readonly taxNumberLabel: string | undefined = undefined,
    /**
     * Where `taxNumber` comes from: 'vat_id' (read off the VAT ID the tax authority confirmed — exact)
     * or 'company_website' (published by the company itself, not officially confirmable).
     */
    public readonly taxNumberSource: SmartEnrichmentTaxNumberSource | undefined = undefined,
    /** How often this row was checked again (`smartEnrichment.recheck()`); undefined when never. */
    public readonly recheckCount: number | undefined = undefined,
    /** When it was last checked again (ISO 8601). */
    public readonly lastRecheckedAt: string | undefined = undefined,
  ) {}

  /** True when the register knows the number under a different name than the one requested. */
  nameMismatch(): boolean {
    return this.nameMatch === 'mismatch';
  }

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
      text('taxNumber'),
      typeof data['vatValid'] === 'boolean' ? data['vatValid'] : undefined,
      num('aiScore'),
      data['nameMatch'] === 'ok' || data['nameMatch'] === 'mismatch' ? data['nameMatch'] : undefined,
      text('officialName'),
      toOfficialAddress(data['officialAddress']),
      text('taxNumberType'),
      text('taxNumberLabel'),
      data['taxNumberSource'] === 'vat_id' || data['taxNumberSource'] === 'company_website'
        ? data['taxNumberSource']
        : undefined,
      num('recheckCount'),
      text('lastRecheckedAt'),
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
      taxNumber: this.taxNumber ?? null,
      vatValid: this.vatValid ?? null,
      aiScore: this.aiScore ?? null,
      nameMatch: this.nameMatch ?? null,
      officialName: this.officialName ?? null,
      officialAddress: this.officialAddress ?? null,
      taxNumberType: this.taxNumberType ?? null,
      taxNumberLabel: this.taxNumberLabel ?? null,
      taxNumberSource: this.taxNumberSource ?? null,
      recheckCount: this.recheckCount ?? null,
      lastRecheckedAt: this.lastRecheckedAt ?? null,
    };
  }
}

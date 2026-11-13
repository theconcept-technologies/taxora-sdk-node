import { type RegisterFactsStatus, toRegisterFactsStatus } from '../enums/RegisterFactsStatus.js';
import {
  type RegisterNote,
  type RegisterPublication,
  toRegisterNote,
  toRegisterPublications,
} from './RegisterFacts.js';

/**
 * What the official commercial register says about a checked company (`vat.registerFacts()`):
 * France via BODACC (by the SIREN in the VAT ID), Spain via BORME. On demand only — never part of
 * the VAT validation.
 */
export class VatRegisterFacts {
  constructor(
    public readonly status: RegisterFactsStatus,
    public readonly country: string | undefined,
    /** 'bodacc' | 'borme'; undefined when no register covers the country. */
    public readonly register: string | undefined,
    /** False when there is no register source for this country (or in the sandbox). */
    public readonly available: boolean,
    /** France: the SIREN read off the VAT ID. */
    public readonly siren: string | undefined,
    /** When the register was asked (ISO 8601). */
    public readonly checkedAt: string | undefined,
    /** When the cached result expires and the register is asked again (ISO 8601). */
    public readonly retryAfter: string | undefined,
    /** True after a register error (retry with `{ refresh: true }`) or when nothing was checked yet. */
    public readonly canRetry: boolean,
    /** The explanation — same shape as `SmartEnrichmentResource.registerNote`. */
    public readonly note: RegisterNote | undefined,
    /** The register announcements as a timeline (id, date, kind, severity, url). */
    public readonly announcements: RegisterPublication[],
  ) {}

  /** True when the register reported something (see `note`). */
  found(): boolean {
    return this.status === 'found';
  }

  static fromArray(data: Record<string, unknown>): VatRegisterFacts {
    const text = (key: string): string | undefined => {
      const v = data[key];
      return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
    };

    return new VatRegisterFacts(
      toRegisterFactsStatus(data['status']),
      text('country'),
      text('register'),
      data['available'] === true,
      text('siren'),
      text('checkedAt'),
      text('retryAfter'),
      data['canRetry'] === true,
      toRegisterNote(data['note']),
      toRegisterPublications(data['announcements']),
    );
  }

  toArray(): Record<string, unknown> {
    return {
      country: this.country ?? null,
      register: this.register ?? null,
      available: this.available,
      status: this.status,
      siren: this.siren ?? null,
      checkedAt: this.checkedAt ?? null,
      retryAfter: this.retryAfter ?? null,
      canRetry: this.canRetry,
      note: this.note ?? null,
      announcements: this.announcements,
    };
  }
}

import { VatState } from '../enums/VatState.js';
import { CompanyAddress } from './CompanyAddress.js';
import { ScoreBreakdown } from './ScoreBreakdown.js';
import { ProviderDocument } from './ProviderDocument.js';

export class VatResource {
  constructor(
    public readonly uuid: string | undefined,
    public readonly vatUid: string | undefined,
    public readonly state: VatState | undefined,
    public readonly countryCode: string | undefined,
    public readonly companyName: string | undefined,
    public readonly companyAddress: CompanyAddress | undefined,
    public readonly requestedCompanyName: string | undefined,
    public readonly requestedCompanyNameOriginal: string | undefined,
    public readonly requestedInputAddress: Record<string, string | null> | undefined,
    public readonly checkedAt: Date | undefined,
    public readonly score: number | undefined,
    public readonly scoreSource: string | undefined,
    public readonly scoreAttempts: Array<{ source?: string; score?: number }> | undefined,
    public readonly breakdown: ScoreBreakdown[] | undefined,
    public readonly environment: string | undefined,
    public readonly provider: string | undefined,
    public readonly usedProviders: string[] | undefined,
    public readonly providerVatState: string | undefined,
    public readonly providerNote: string | undefined,
    public readonly providerLastCheckedAt: Date | undefined,
    public readonly providerDocument: ProviderDocument | undefined,
  ) {}

  static fromArray(data: Record<string, unknown>): VatResource {
    const str = (key: string): string | undefined => {
      const v = data[key];
      return typeof v === 'string' ? v : undefined;
    };

    const stateRaw = str('state');
    const state = stateRaw !== undefined && Object.values(VatState).includes(stateRaw as VatState)
      ? (stateRaw as VatState)
      : undefined;

    const checkedAt = str('checked_at') ? new Date(data['checked_at'] as string) : undefined;
    const providerLastCheckedAt = str('provider_last_checked_at')
      ? new Date(data['provider_last_checked_at'] as string)
      : undefined;

    const breakdown = Array.isArray(data['breakdown'])
      ? (data['breakdown'] as Record<string, unknown>[]).map(ScoreBreakdown.fromArray)
      : undefined;

    const usedProviders = Array.isArray(data['used_providers'])
      ? (data['used_providers'] as unknown[]).filter((v): v is string => typeof v === 'string')
      : undefined;

    const scoreAttempts = Array.isArray(data['score_attempts'])
      ? (data['score_attempts'] as Record<string, unknown>[])
      : undefined;

    const requestedInputAddress =
      data['requested_input_address'] !== null &&
      typeof data['requested_input_address'] === 'object' &&
      !Array.isArray(data['requested_input_address'])
        ? (data['requested_input_address'] as Record<string, string | null>)
        : undefined;

    return new VatResource(
      str('uuid'),
      str('vat_uid'),
      state,
      str('country_code'),
      str('company_name'),
      CompanyAddress.from(data['company_address']) ?? undefined,
      str('requested_company_name'),
      str('requested_company_name_original'),
      requestedInputAddress,
      checkedAt,
      typeof data['score'] === 'number' ? data['score'] : undefined,
      str('score_source'),
      scoreAttempts,
      breakdown,
      str('environment'),
      str('provider'),
      usedProviders,
      str('provider_vat_state'),
      str('provider_note'),
      providerLastCheckedAt,
      ProviderDocument.fromArray(data['provider_document']) ?? undefined,
    );
  }

  getBackendLink(): string | null {
    if (!this.uuid) return null;
    if (this.environment === 'LIVE') {
      return `https://app.taxora.io/vat/history/${this.uuid}`;
    }
    return `https://app.sandbox.taxora.io/vat/history/${this.uuid}`;
  }

  toArray(): Record<string, unknown> {
    return {
      uuid: this.uuid,
      vat_uid: this.vatUid,
      state: this.state,
      country_code: this.countryCode,
      company_name: this.companyName,
      company_address: this.companyAddress?.toArray() ?? null,
      requested_company_name: this.requestedCompanyName,
      requested_company_name_original: this.requestedCompanyNameOriginal,
      requested_input_address: this.requestedInputAddress ?? null,
      checked_at: this.checkedAt?.toISOString() ?? null,
      score: this.score ?? null,
      score_source: this.scoreSource ?? null,
      score_attempts: this.scoreAttempts ?? null,
      breakdown: this.breakdown?.map((b) => b.toArray()) ?? null,
      environment: this.environment ?? null,
      provider: this.provider ?? null,
      used_providers: this.usedProviders ?? null,
      provider_vat_state: this.providerVatState ?? null,
      provider_note: this.providerNote ?? null,
      provider_last_checked_at: this.providerLastCheckedAt?.toISOString() ?? null,
      provider_document: this.providerDocument?.toArray() ?? null,
    };
  }
}

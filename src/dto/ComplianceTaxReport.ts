import { type ComplianceTaxReportState, toComplianceTaxReportState } from '../enums/ComplianceTaxReportState.js';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Monetary values are kept as the decimal strings returned by the API (no
 * Number conversion) to preserve precision.
 */
function asMoney(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '0.00';
}

/**
 * A DGFiP tax report tracking one transaction through the aggregated daily
 * ledger lifecycle (GET /compliance/tax-reports).
 */
export class ComplianceTaxReport {
  constructor(
    public readonly id: number,
    public readonly companyId: number,
    public readonly complianceTransactionId: number | null,
    public readonly ledgerId: number | null,
    public readonly country: string,
    public readonly regime: string,
    public readonly state: ComplianceTaxReportState,
    public readonly stateLabel: string,
    /** True once the report reached a final state (registered, refused or error). */
    public readonly isTerminal: boolean,
    public readonly providerTaxReportId: string | null,
    public readonly providerLedgerId: string | null,
    public readonly baseAmount: string,
    public readonly taxAmount: string,
    public readonly totalAmount: string,
    public readonly refusalReason: string | null,
    public readonly registeredAt: string | null,
    public readonly refusedAt: string | null,
    public readonly createdAt: string | null,
    public readonly updatedAt: string | null,
  ) {}

  static fromArray(data: Record<string, unknown>): ComplianceTaxReport {
    return new ComplianceTaxReport(
      asNumber(data['id']),
      asNumber(data['company_id']),
      asNullableNumber(data['compliance_transaction_id']),
      asNullableNumber(data['ledger_id']),
      asString(data['country']),
      asString(data['regime']),
      toComplianceTaxReportState(data['state']),
      asString(data['state_label']),
      data['is_terminal'] === true,
      asNullableString(data['provider_tax_report_id']),
      asNullableString(data['provider_ledger_id']),
      asMoney(data['base_amount']),
      asMoney(data['tax_amount']),
      asMoney(data['total_amount']),
      asNullableString(data['refusal_reason']),
      asNullableString(data['registered_at']),
      asNullableString(data['refused_at']),
      asNullableString(data['created_at']),
      asNullableString(data['updated_at']),
    );
  }
}

import { ComplianceTaxReport } from './ComplianceTaxReport.js';
import { type ComplianceTransactionState, toComplianceTransactionState } from '../enums/ComplianceTransactionState.js';
import { type ComplianceTransactionType, toComplianceTransactionType } from '../enums/ComplianceTransactionType.js';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
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
 * A recorded e-reporting transaction (GET/POST /compliance/transactions).
 */
export class ComplianceTransaction {
  constructor(
    public readonly id: number,
    public readonly companyId: number,
    public readonly complianceEnrollmentId: number,
    public readonly country: string,
    public readonly regime: string,
    public readonly transactionType: ComplianceTransactionType,
    public readonly transactionTypeLabel: string,
    public readonly state: ComplianceTransactionState,
    public readonly stateLabel: string,
    public readonly invoiceNumber: string,
    /** Invoice date (YYYY-MM-DD). */
    public readonly invoiceDate: string | null,
    public readonly dueDate: string | null,
    public readonly currency: string,
    public readonly subtotal: string,
    public readonly taxAmount: string,
    public readonly total: string,
    public readonly counterpartyName: string | null,
    public readonly counterpartyCountry: string | null,
    public readonly counterpartyVatNumber: string | null,
    public readonly isPaid: boolean,
    public readonly paidAt: string | null,
    public readonly providerInvoiceId: string | null,
    public readonly submissionError: string | null,
    public readonly reportedAt: string | null,
    /** Associated DGFiP tax report; undefined when the API did not include it. */
    public readonly taxReport: ComplianceTaxReport | undefined,
    public readonly createdAt: string | null,
    public readonly updatedAt: string | null,
  ) {}

  static fromArray(data: Record<string, unknown>): ComplianceTransaction {
    const taxReport =
      typeof data['tax_report'] === 'object' && data['tax_report'] !== null && !Array.isArray(data['tax_report'])
        ? ComplianceTaxReport.fromArray(data['tax_report'] as Record<string, unknown>)
        : undefined;

    return new ComplianceTransaction(
      asNumber(data['id']),
      asNumber(data['company_id']),
      asNumber(data['compliance_enrollment_id']),
      asString(data['country']),
      asString(data['regime']),
      toComplianceTransactionType(data['transaction_type']),
      asString(data['transaction_type_label']),
      toComplianceTransactionState(data['state']),
      asString(data['state_label']),
      asString(data['invoice_number']),
      asNullableString(data['invoice_date']),
      asNullableString(data['due_date']),
      asString(data['currency'], 'EUR'),
      asMoney(data['subtotal']),
      asMoney(data['tax_amount']),
      asMoney(data['total']),
      asNullableString(data['counterparty_name']),
      asNullableString(data['counterparty_country']),
      asNullableString(data['counterparty_vat_number']),
      data['is_paid'] === true,
      asNullableString(data['paid_at']),
      asNullableString(data['provider_invoice_id']),
      asNullableString(data['submission_error']),
      asNullableString(data['reported_at']),
      taxReport,
      asNullableString(data['created_at']),
      asNullableString(data['updated_at']),
    );
  }
}

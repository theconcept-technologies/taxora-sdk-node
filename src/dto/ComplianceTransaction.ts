import { ComplianceTaxReport } from './ComplianceTaxReport.js';
import { ComplianceDocumentType, toComplianceDocumentType } from '../enums/ComplianceDocumentType.js';
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

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecordList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => asRecord(row) !== null) : [];
}

/** One tax of a stored invoice line (provider shape, as recorded at creation/update). */
export interface ComplianceTransactionInvoiceLineTax {
  name: string;
  percent: number | null;
  category: string | null;
  /** VATEX exemption code for category "E". */
  comment: string | null;
}

/** One stored invoice line (`provider_payload.invoice.invoice_lines_attributes`). */
export interface ComplianceTransactionInvoiceLine {
  description: string;
  quantity: number | null;
  /** Unit price as a precision-safe decimal string. */
  price: string;
  /** UN/ECE unit code, e.g. 9 (each). */
  unit: number | null;
  taxes: ComplianceTransactionInvoiceLineTax[];
}

function toInvoiceLines(providerPayload: unknown): ComplianceTransactionInvoiceLine[] {
  const invoice = asRecord(asRecord(providerPayload)?.['invoice']);

  return asRecordList(invoice?.['invoice_lines_attributes']).map((line) => ({
    description: asString(line['description']),
    quantity: asNullableNumber(line['quantity']),
    price: asMoney(line['price']),
    unit: asNullableNumber(line['unit']),
    taxes: asRecordList(line['taxes_attributes']).map((tax) => ({
      name: asString(tax['name']),
      percent: asNullableNumber(tax['percent']),
      category: asNullableString(tax['category']),
      comment: asNullableString(tax['comment']),
    })),
  }));
}

/**
 * A recorded compliance transaction (GET/POST /compliance/transactions) — an
 * e-reported transaction (France) or an e-invoice / credit note (Norway).
 *
 * The e-invoicing fields at the end of the constructor are optional so DTOs
 * built from older servers (or by hand) stay valid.
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
    /** Buyer's company register id (Norway: 9-digit organisation number). */
    public readonly counterpartyRegisterId: string | null = null,
    public readonly counterpartyAddress: string | null = null,
    public readonly counterpartyCity: string | null = null,
    public readonly counterpartyPostalcode: string | null = null,
    public readonly counterpartyEmail: string | null = null,
    public readonly buyerReference: string | null = null,
    /** "invoice" or "credit_note" (older servers without the field → "invoice"). */
    public readonly documentType: ComplianceDocumentType = ComplianceDocumentType.INVOICE,
    /** Number of the invoice a credit note corrects. */
    public readonly amendedNumber: string | null = null,
    /** Date of the invoice a credit note corrects (YYYY-MM-DD). */
    public readonly amendedDate: string | null = null,
    /**
     * Latest provider-side delivery state (e.g. "sent", "accepted", "refused",
     * "paid") — richer than `state` for e-invoicing, where delivery continues
     * after submission. Free-form string; null until the provider reports one.
     */
    public readonly providerState: string | null = null,
    /** The stored invoice lines (empty when the server does not include them). */
    public readonly invoiceLines: ComplianceTransactionInvoiceLine[] = [],
  ) {}

  get isCreditNote(): boolean {
    return this.documentType === ComplianceDocumentType.CREDIT_NOTE;
  }

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
      asNullableString(data['counterparty_register_id']),
      asNullableString(data['counterparty_address']),
      asNullableString(data['counterparty_city']),
      asNullableString(data['counterparty_postalcode']),
      asNullableString(data['counterparty_email']),
      asNullableString(data['buyer_reference']),
      data['document_type'] === undefined || data['document_type'] === null
        ? ComplianceDocumentType.INVOICE
        : toComplianceDocumentType(data['document_type']),
      asNullableString(data['amended_number']),
      asNullableString(data['amended_date']),
      asNullableString(data['provider_state']),
      toInvoiceLines(data['provider_payload']),
    );
  }
}

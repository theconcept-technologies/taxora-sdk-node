import { type ComplianceInvoiceLineInput } from '../endpoints/EReportingEndpoint.js';

export interface InvoiceTotals {
  /** Sum of the line net amounts, 2 decimals. */
  subtotal: number;
  /** Sum of the line VAT amounts, 2 decimals. */
  taxAmount: number;
  /** subtotal + taxAmount, 2 decimals. */
  total: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Subtotal, VAT and total of invoice lines, computed the way the e-invoice is built: every line is
 * quantity × price rounded to cents, VAT per line at the rates of its taxes. Use it so the header
 * amounts of createTransaction() always match the lines (the API refuses an e-invoice whose amounts
 * disagree with its lines).
 */
export function calculateInvoiceTotals(lines: ComplianceInvoiceLineInput[]): InvoiceTotals {
  let net = 0;
  let tax = 0;
  for (const line of lines) {
    const lineNet = round2(line.quantity * line.price);
    const percent = line.taxes.reduce((sum, t) => sum + t.percent, 0);
    net += lineNet;
    tax += round2((lineNet * percent) / 100);
  }
  const subtotal = round2(net);
  const taxAmount = round2(tax);
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) };
}

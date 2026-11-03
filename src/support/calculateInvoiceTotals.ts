import { type ComplianceInvoiceLineInput } from '../endpoints/EReportingEndpoint.js';

export interface InvoiceTotals {
  /** Sum of the line net amounts, 2 decimals. */
  subtotal: number;
  /** Sum of the line VAT amounts, 2 decimals. */
  taxAmount: number;
  /** subtotal + taxAmount, 2 decimals. */
  total: number;
  /** Expected total minus computed total (0 when no expected total was given). */
  roundingDifference: number;
}

export interface InvoiceTotalsOptions {
  /**
   * The total your own system shows the buyer. The totals always follow the lines (the e-invoice is built
   * from them); this only checks that your total is within rounding distance and reports the difference.
   */
  expectedTotal?: number;
  /** Largest accepted difference to the expected total (default 0.05). */
  tolerance?: number;
}

/** Half away from zero on the decimal value (a pre-rounding step absorbs float noise like 53641.534999999996). */
function round2(value: number): number {
  const magnitude = Math.round(Number((Math.abs(value) * 100).toPrecision(15)));
  return (value < 0 ? -magnitude : magnitude) / 100;
}

/**
 * Subtotal, VAT and total of invoice lines, computed the way the e-invoice is built: every line is
 * quantity × price rounded to cents, VAT per line at the rates of its taxes. Use it so the header
 * amounts of createTransaction() always match the lines (the API refuses an e-invoice whose amounts
 * disagree with its lines).
 */
export function calculateInvoiceTotals(
  lines: ComplianceInvoiceLineInput[],
  options: InvoiceTotalsOptions = {},
): InvoiceTotals {
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
  const total = round2(subtotal + taxAmount);

  let roundingDifference = 0;
  if (options.expectedTotal !== undefined) {
    if (!Number.isFinite(options.expectedTotal)) {
      throw new Error('The expected total must be numeric.');
    }
    const tolerance = options.tolerance ?? 0.05;
    roundingDifference = round2(options.expectedTotal - total);
    if (Math.abs(roundingDifference) > tolerance) {
      throw new Error(
        `The expected total ${options.expectedTotal.toFixed(2)} differs from the invoice lines (${total.toFixed(2)}) by ${roundingDifference.toFixed(2)}, more than the rounding tolerance of ${tolerance.toFixed(2)}. Check quantities, prices and tax rates.`,
      );
    }
  }

  return { subtotal, taxAmount, total, roundingDifference };
}

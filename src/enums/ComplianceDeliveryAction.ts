/**
 * What to do with an invoice to a buyer, derived from the Peppol directory
 * (EReportingEndpoint.decideDelivery()).
 */
export const ComplianceDeliveryAction = {
  /** The buyer can receive e-invoices: create the transaction, Taxora sends it. */
  EINVOICE: 'einvoice',
  /** The buyer is not on the network: send your regular invoice yourself (a transaction would end as not_required and is not billed). */
  REGULAR_INVOICE: 'regular_invoice',
  /** No definite directory answer yet: create the transaction anyway, Taxora asks again before sending. */
  EINVOICE_PENDING: 'einvoice_pending',
} as const;

export type ComplianceDeliveryAction = (typeof ComplianceDeliveryAction)[keyof typeof ComplianceDeliveryAction];

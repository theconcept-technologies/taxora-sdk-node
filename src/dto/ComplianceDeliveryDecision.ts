import { ComplianceDeliveryAction } from '../enums/ComplianceDeliveryAction.js';
import { PeppolLookupStatus } from '../enums/PeppolLookupStatus.js';
import { type PeppolLookupResult } from './PeppolLookupResult.js';

/** The action for one buyer plus the directory answer it is based on (EReportingEndpoint.decideDelivery()). */
export class ComplianceDeliveryDecision {
  constructor(
    public readonly action: ComplianceDeliveryAction,
    public readonly lookup: PeppolLookupResult,
  ) {}

  /** True unless the buyer is not on the network. */
  get sendsEInvoice(): boolean {
    return this.action !== ComplianceDeliveryAction.REGULAR_INVOICE;
  }

  static fromLookup(lookup: PeppolLookupResult): ComplianceDeliveryDecision {
    switch (lookup.status) {
      case PeppolLookupStatus.REACHABLE:
        return new ComplianceDeliveryDecision(ComplianceDeliveryAction.EINVOICE, lookup);
      case PeppolLookupStatus.NOT_REACHABLE:
        return new ComplianceDeliveryDecision(ComplianceDeliveryAction.REGULAR_INVOICE, lookup);
      default:
        return new ComplianceDeliveryDecision(ComplianceDeliveryAction.EINVOICE_PENDING, lookup);
    }
  }
}

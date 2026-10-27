/**
 * Typed shapes of the JSON bodies Taxora POSTs to your webhook endpoint.
 *
 * Every event shares the same envelope ({@link WebhookEventEnvelope}); `event` narrows `data.object`:
 *
 * ```ts
 * const event = constructWebhookEvent(rawBody, header, secret);
 * if (event.event === 'vat.validated') {
 *   event.data.object.vat_uid; // string
 * }
 * ```
 */

export type WebhookEventType =
  | 'vat.validated'
  | 'vat.state_changed'
  | 'compliance.ledger.state_changed'
  | 'compliance.transaction.state_changed'
  | 'enrichment.completed'
  | 'enrichment.updated'
  | 'webhook.test';

export interface WebhookEventEnvelope<TEvent extends string, TObject> {
  /** Delivery UUID — identical to the `Taxora-Webhook-Id` header and stable across retries. Use it to dedupe. */
  id: string;
  event: TEvent;
  /** Unix seconds when the event was created (not the delivery attempt — that is `t` in the signature). */
  timestamp: number;
  data: { object: TObject };
}

export interface VatWebhookObject {
  id: number;
  vat_uid: string;
  /** A VatState value, e.g. `valid`, `invalid`. */
  state: string;
  company_name: string | null;
  country_code: string | null;
  checked_at: string | null;
}

export interface ComplianceLedgerWebhookObject {
  id: number;
  state: string;
  ledger_type: string | null;
  ledger_date: string | null;
}

/**
 * `compliance.transaction.state_changed` payload. Sent for every real change of a
 * transaction — Taxora's own state (submitted, error, not_required) and the
 * provider's delivery state (accepted, refused, paid, …); never twice for the
 * same state and never for the transient `sending`.
 *
 * The optional fields were added later and are missing on older deliveries.
 */
export interface ComplianceTransactionWebhookObject {
  id: number;
  /** A ComplianceTransactionState value, e.g. `submitted`, `error`, `not_required`. */
  state: string;
  /** Provider-side delivery state, e.g. `sent`, `accepted`, `refused`, `paid`. */
  provider_state: string | null;
  /** Lowercase ISO 3166-1 alpha-2 code, e.g. `no`. */
  country: string | null;
  invoice_number: string | null;
  /** Your own reference of the transaction. */
  internal_reference?: string | null;
  /** Taxora state before this change. */
  previous_state?: string | null;
  /** Provider state before this change. */
  previous_provider_state?: string | null;
  /** The buyer refused the e-invoice — issue a credit note. */
  buyer_rejected?: boolean;
  /** The buyer's reason for the rejection, when given. */
  rejection_reason?: string | null;
  /** Why sending failed (state `error`). */
  submission_error?: string | null;
  /** Peppol directory result, e.g. `not_reachable` when the state is `not_required`. */
  delivery_check?: string | null;
}

/** True when the buyer refused the e-invoice (false for older deliveries without the field). */
export function isTransactionBuyerRejected(object: ComplianceTransactionWebhookObject): boolean {
  return object.buyer_rejected === true;
}

/** Raw Smart Enrichment rows — wrap them with `SmartEnrichmentResource.fromArray()` for a typed DTO. */
export interface EnrichmentCompletedWebhookObject {
  jobId: string;
  status: string;
  itemCount: number;
  foundCount: number;
  results: Record<string, unknown>[];
}

export interface EnrichmentUpdatedWebhookObject {
  jobId: string;
  status: string;
  itemCount: number;
  foundCount: number;
  /** Zero-based index of the row that changed, matching `results[rowIndex]` of enrichment.completed. */
  rowIndex: number;
  result: Record<string, unknown> | null;
}

export interface TestWebhookObject {
  message: string;
}

export type VatValidatedEvent = WebhookEventEnvelope<'vat.validated', VatWebhookObject>;
export type VatStateChangedEvent = WebhookEventEnvelope<'vat.state_changed', VatWebhookObject>;
export type ComplianceLedgerStateChangedEvent = WebhookEventEnvelope<
  'compliance.ledger.state_changed',
  ComplianceLedgerWebhookObject
>;
export type ComplianceTransactionStateChangedEvent = WebhookEventEnvelope<
  'compliance.transaction.state_changed',
  ComplianceTransactionWebhookObject
>;
export type EnrichmentCompletedEvent = WebhookEventEnvelope<'enrichment.completed', EnrichmentCompletedWebhookObject>;
export type EnrichmentUpdatedEvent = WebhookEventEnvelope<'enrichment.updated', EnrichmentUpdatedWebhookObject>;
export type WebhookTestEvent = WebhookEventEnvelope<'webhook.test', TestWebhookObject>;

/** Discriminated union of every event Taxora sends. Switch on `event` to narrow `data.object`. */
export type TaxoraWebhookEvent =
  | VatValidatedEvent
  | VatStateChangedEvent
  | ComplianceLedgerStateChangedEvent
  | ComplianceTransactionStateChangedEvent
  | EnrichmentCompletedEvent
  | EnrichmentUpdatedEvent
  | WebhookTestEvent;

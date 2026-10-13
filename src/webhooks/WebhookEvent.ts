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

export interface ComplianceTransactionWebhookObject {
  id: number;
  state: string;
  provider_state: string | null;
  country: string | null;
  invoice_number: string | null;
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

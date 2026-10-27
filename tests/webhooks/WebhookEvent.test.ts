import { describe, it, expect } from 'vitest';
import {
  constructWebhookEvent,
  generateWebhookSignatureHeader,
  isBuyerRejected,
  type ComplianceTransactionWebhookObject,
} from '../../src/index.js';

const SECRET = 'whsec_test';
const NOW = 1700000000;

function signedTransactionEvent(object: Record<string, unknown>) {
  const body = JSON.stringify({
    id: 'evt_tx',
    event: 'compliance.transaction.state_changed',
    timestamp: NOW,
    data: { object },
  });
  return constructWebhookEvent(body, generateWebhookSignatureHeader(body, SECRET, NOW), SECRET, { now: NOW });
}

describe('compliance.transaction.state_changed payload', () => {
  it('carries the full status-signal payload', () => {
    const event = signedTransactionEvent({
      id: 88,
      invoice_number: 'NO-2026-0001',
      internal_reference: 'ERP-4711',
      country: 'no',
      state: 'submitted',
      previous_state: 'submitted',
      provider_state: 'refused',
      previous_provider_state: 'accepted',
      buyer_rejected: true,
      rejection_reason: 'Wrong order number',
      submission_error: null,
      delivery_check: null,
    });

    expect(event.event).toBe('compliance.transaction.state_changed');
    if (event.event !== 'compliance.transaction.state_changed') return;
    const tx = event.data.object;
    expect(tx.internal_reference).toBe('ERP-4711');
    expect(tx.previous_state).toBe('submitted');
    expect(tx.provider_state).toBe('refused');
    expect(tx.previous_provider_state).toBe('accepted');
    expect(tx.rejection_reason).toBe('Wrong order number');
    expect(isBuyerRejected(tx)).toBe(true);
  });

  it('exposes not_required with the delivery check and errors with the submission error', () => {
    const notRequired: ComplianceTransactionWebhookObject = {
      id: 89,
      state: 'not_required',
      provider_state: null,
      country: 'no',
      invoice_number: 'NO-2026-0002',
      previous_state: 'pending',
      delivery_check: 'not_reachable',
    };
    expect(notRequired.delivery_check).toBe('not_reachable');
    expect(isBuyerRejected(notRequired)).toBe(false);

    const event = signedTransactionEvent({
      id: 90,
      state: 'error',
      submission_error: 'Provider rejected the document',
    });
    if (event.event !== 'compliance.transaction.state_changed') throw new Error('unexpected event');
    expect(event.data.object.submission_error).toBe('Provider rejected the document');
  });

  it('tolerates older deliveries without the new fields', () => {
    const older: ComplianceTransactionWebhookObject = {
      id: 88,
      state: 'submitted',
      provider_state: 'sent',
      country: 'no',
      invoice_number: 'NO-1',
    };
    expect(isBuyerRejected(older)).toBe(false);
    expect(older.previous_state).toBeUndefined();
  });
});

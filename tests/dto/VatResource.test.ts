import { describe, it, expect } from 'vitest';
import { VatResource } from '../../src/dto/VatResource.js';
import { VatCollection } from '../../src/dto/VatCollection.js';
import { VatState } from '../../src/enums/VatState.js';
import { ScoreBreakdown } from '../../src/dto/ScoreBreakdown.js';
import { CompanyAddress } from '../../src/dto/CompanyAddress.js';
import { ProviderDocument } from '../../src/dto/ProviderDocument.js';

const FULL_RESPONSE = {
  uuid: 'uuid-123',
  vat_uid: 'ATU12345678',
  state: 'valid',
  country_code: 'AT',
  company_name: 'Alpha Handels GmbH',
  company_address: JSON.stringify({ street: 'Ringstraße 1', postal_code: '1010', city: 'Wien', country: 'AT' }),
  requested_company_name: 'Alpha Handels',
  requested_company_name_original: 'alpha handels',
  requested_input_address: { address_line_1: 'Ringstraße 1' },
  checked_at: '2024-06-01T12:00:00.000Z',
  score: 0.95,
  score_source: 'name_match',
  score_attempts: [{ source: 'name_match', score: 0.95 }],
  breakdown: [{ step_name: 'name_check', score_contribution: 0.95, metadata: {} }],
  environment: 'LIVE',
  provider: 'vies',
  used_providers: ['vies', 'manual'],
  provider_vat_state: 'valid',
  provider_note: 'Registered',
  provider_last_checked_at: '2024-05-30T08:00:00.000Z',
  has_api_error: true,
  error_message: 'VIES service unavailable.',
  next_api_recheck_at: '2026-04-24T14:00:00Z',
  provider_document: { id: 1, provider: 'vies', document_type: 'VAT_REGISTER' },
};

describe('VatResource', () => {
  it('fromArray maps all fields correctly', () => {
    const vat = VatResource.fromArray(FULL_RESPONSE);
    expect(vat.uuid).toBe('uuid-123');
    expect(vat.vatUid).toBe('ATU12345678');
    expect(vat.state).toBe(VatState.VALID);
    expect(vat.countryCode).toBe('AT');
    expect(vat.companyName).toBe('Alpha Handels GmbH');
    expect(vat.companyAddress).toBeInstanceOf(CompanyAddress);
    expect(vat.requestedCompanyName).toBe('Alpha Handels');
    expect(vat.requestedCompanyNameOriginal).toBe('alpha handels');
    expect(vat.checkedAt).toBeInstanceOf(Date);
    expect(vat.score).toBe(0.95);
    expect(vat.scoreSource).toBe('name_match');
    expect(vat.breakdown).toHaveLength(1);
    expect(vat.breakdown![0]).toBeInstanceOf(ScoreBreakdown);
    expect(vat.environment).toBe('LIVE');
    expect(vat.provider).toBe('vies');
    expect(vat.usedProviders).toEqual(['vies', 'manual']);
    expect(vat.providerDocument).toBeInstanceOf(ProviderDocument);
    expect(vat.providerLastCheckedAt).toBeInstanceOf(Date);
    expect(vat.hasApiError).toBe(true);
    expect(vat.errorMessage).toBe('VIES service unavailable.');
    expect(vat.nextApiRecheckAt).toBe('2026-04-24T14:00:00Z');
  });

  it('fromArray handles missing optional fields gracefully', () => {
    const vat = VatResource.fromArray({ vat_uid: 'DE123456789' });
    expect(vat.vatUid).toBe('DE123456789');
    expect(vat.uuid).toBeUndefined();
    expect(vat.state).toBeUndefined();
    expect(vat.breakdown).toBeUndefined();
    expect(vat.hasApiError).toBeUndefined();
    expect(vat.errorMessage).toBeUndefined();
    expect(vat.nextApiRecheckAt).toBeUndefined();
  });

  it('preserves null API error metadata when present as null', () => {
    const vat = VatResource.fromArray({
      vat_uid: 'DE123456789',
      has_api_error: null,
      error_message: null,
      next_api_recheck_at: null,
    });

    expect(vat.hasApiError).toBeNull();
    expect(vat.errorMessage).toBeNull();
    expect(vat.nextApiRecheckAt).toBeNull();
  });

  it('getBackendLink returns LIVE URL', () => {
    const vat = VatResource.fromArray({ uuid: 'abc-123', environment: 'LIVE' });
    expect(vat.getBackendLink()).toBe('https://app.taxora.io/vat/history/abc-123');
  });

  it('getBackendLink returns SANDBOX URL', () => {
    const vat = VatResource.fromArray({ uuid: 'abc-123', environment: 'SANDBOX' });
    expect(vat.getBackendLink()).toBe('https://app.sandbox.taxora.io/vat/history/abc-123');
  });

  it('getBackendLink returns null when uuid missing', () => {
    const vat = VatResource.fromArray({ environment: 'LIVE' });
    expect(vat.getBackendLink()).toBeNull();
  });

  it('toArray serializes all fields', () => {
    const vat = VatResource.fromArray(FULL_RESPONSE);
    const arr = vat.toArray();
    expect(arr['uuid']).toBe('uuid-123');
    expect(arr['vat_uid']).toBe('ATU12345678');
    expect(arr['state']).toBe('valid');
    expect(typeof arr['checked_at']).toBe('string');
    expect(Array.isArray(arr['breakdown'])).toBe(true);
    expect(arr['provider_document']).toBeDefined();
    expect(arr['has_api_error']).toBe(true);
    expect(arr['error_message']).toBe('VIES service unavailable.');
    expect(arr['next_api_recheck_at']).toBe('2026-04-24T14:00:00Z');
  });

  it('toArray includes address fallback response fields', () => {
    const vat = VatResource.fromArray({
      ...FULL_RESPONSE,
      requested_input_address: { address_line_1: 'Ringstraße 1' },
    });
    const arr = vat.toArray();
    expect(arr['requested_input_address']).toEqual({ address_line_1: 'Ringstraße 1' });
  });
});

describe('VatCollection', () => {
  it('fromResponse handles data-wrapped array', () => {
    const collection = VatCollection.fromResponse({
      data: [{ vat_uid: 'ATU12345678' }, { vat_uid: 'DE123456789' }],
      self: 'https://api.taxora.io/v1/vat/history',
    });
    expect(collection.length).toBe(2);
    expect(collection.self).toBe('https://api.taxora.io/v1/vat/history');
  });

  it('fromResponse handles flat array', () => {
    const collection = VatCollection.fromResponse([{ vat_uid: 'ATU12345678' }]);
    expect(collection.length).toBe(1);
  });

  it('is iterable', () => {
    const collection = VatCollection.fromResponse([{ vat_uid: 'ATU12345678' }, { vat_uid: 'DE123456789' }]);
    const items = [...collection];
    expect(items).toHaveLength(2);
    expect(items[0]).toBeInstanceOf(VatResource);
  });

  it('all() returns all items', () => {
    const collection = VatCollection.fromResponse([{ vat_uid: 'ATU12345678' }]);
    expect(collection.all()).toHaveLength(1);
  });
});

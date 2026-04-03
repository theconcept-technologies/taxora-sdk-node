import { describe, it, expect } from 'vitest';
import { CompanyAddress } from '../../src/dto/CompanyAddress.js';

describe('CompanyAddress', () => {
  it('creates from JSON string with full fields', () => {
    const json = JSON.stringify({
      name: 'Alpha GmbH',
      street: 'Ringstraße 1',
      postal_code: '1010',
      city: 'Wien',
      country: 'AT',
    });
    const address = CompanyAddress.from(json);
    expect(address).not.toBeNull();
    expect(address!.name).toBe('Alpha GmbH');
    expect(address!.street).toBe('Ringstraße 1');
    expect(address!.city).toBe('Wien');
    expect(address!.postalCode).toBe('1010');
    expect(address!.country).toBe('AT');
  });

  it('creates from JSON with only full_address field', () => {
    const json = JSON.stringify({ full_address: '10 Rue de Rivoli, 75001 Paris' });
    const address = CompanyAddress.from(json);
    expect(address).not.toBeNull();
    expect(address!.fullAddress).toBe('10 Rue de Rivoli, 75001 Paris');
  });

  it('assembles fullAddress from components when missing', () => {
    const address = CompanyAddress.fromArray({
      street: 'Hauptstraße 12',
      postal_code: '10115',
      city: 'Berlin',
      country: 'DE',
    }, null);
    expect(address.fullAddress).toContain('Hauptstraße 12');
    expect(address.fullAddress).toContain('Berlin');
  });

  it('returns null for empty string', () => {
    expect(CompanyAddress.from('')).toBeNull();
    expect(CompanyAddress.from(null)).toBeNull();
    expect(CompanyAddress.from(undefined)).toBeNull();
  });

  it('falls back to plain string when JSON is invalid', () => {
    const address = CompanyAddress.from('Via Roma 25, 00100 Roma');
    expect(address).not.toBeNull();
    expect(address!.raw).toBe('Via Roma 25, 00100 Roma');
    expect(address!.toString()).toBe('Via Roma 25, 00100 Roma');
  });

  it('creates from plain object', () => {
    const address = CompanyAddress.from({ city: 'London', country: 'GB' });
    expect(address).not.toBeNull();
    expect(address!.city).toBe('London');
  });

  it('toArray serializes all fields', () => {
    const address = new CompanyAddress({
      fullAddress: '221B Baker Street, NW1 6XE London',
      name: 'Epsilon Solutions Ltd',
      street: '221B Baker Street',
      postalCode: 'NW1 6XE',
      city: 'London',
      country: 'GB',
      raw: null,
    });
    const arr = address.toArray();
    expect(arr['full_address']).toBe('221B Baker Street, NW1 6XE London');
    expect(arr['name']).toBe('Epsilon Solutions Ltd');
    expect(arr['city']).toBe('London');
  });

  it('toString returns fullAddress or raw', () => {
    const a1 = new CompanyAddress({ fullAddress: 'Full Address', raw: null });
    expect(a1.toString()).toBe('Full Address');

    const a2 = new CompanyAddress({ fullAddress: null, raw: 'Raw String' });
    expect(a2.toString()).toBe('Raw String');
  });
});

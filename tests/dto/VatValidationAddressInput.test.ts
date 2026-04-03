import { describe, it, expect } from 'vitest';
import { VatValidationAddressInput } from '../../src/dto/VatValidationAddressInput.js';

describe('VatValidationAddressInput', () => {
  it('constructs with valid fields', () => {
    const input = new VatValidationAddressInput({
      addressLine1: 'Ringstraße 1',
      city: 'Wien',
      postalCode: '1010',
      countryCode: 'AT',
    });
    expect(input.addressLine1).toBe('Ringstraße 1');
    expect(input.city).toBe('Wien');
    expect(input.countryCode).toBe('AT');
  });

  it('toArray omits undefined fields', () => {
    const input = new VatValidationAddressInput({ addressLine1: 'Hauptstraße 12', countryCode: 'DE' });
    const arr = input.toArray();
    expect(arr['address_line_1']).toBe('Hauptstraße 12');
    expect(arr['country_code']).toBe('DE');
    expect(Object.keys(arr)).not.toContain('address_line_2');
    expect(Object.keys(arr)).not.toContain('postal_code');
    expect(Object.keys(arr)).not.toContain('city');
  });

  it('fromArray normalizes and trims fields', () => {
    const input = VatValidationAddressInput.fromArray({
      address_line_1: '  Via Roma 25  ',
      postal_code: '00100',
      city: 'Roma',
      country_code: 'it',
    });
    expect(input.addressLine1).toBe('Via Roma 25');
    expect(input.countryCode).toBe('IT');
  });

  it('throws on addressLine1 longer than 255 characters', () => {
    expect(() => new VatValidationAddressInput({ addressLine1: 'A'.repeat(256) })).toThrow();
  });

  it('throws on addressLine2 longer than 255 characters', () => {
    expect(() => new VatValidationAddressInput({ addressLine2: 'B'.repeat(256) })).toThrow();
  });

  it('throws on countryCode not exactly 2 characters', () => {
    expect(() => new VatValidationAddressInput({ countryCode: 'DEU' })).toThrow();
    expect(() => new VatValidationAddressInput({ countryCode: 'D' })).toThrow();
  });

  it('fromArray rejects addressLine3', () => {
    expect(() => VatValidationAddressInput.fromArray({ address_line_3: 'extra' })).toThrow();
  });

  it('fromArray rejects unknown fields', () => {
    expect(() => VatValidationAddressInput.fromArray({ unknown_field: 'value' })).toThrow();
  });
});

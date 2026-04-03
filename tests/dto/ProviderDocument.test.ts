import { describe, it, expect } from 'vitest';
import { ProviderDocument } from '../../src/dto/ProviderDocument.js';
import { ProviderDocumentLine } from '../../src/dto/ProviderDocumentLine.js';

describe('ProviderDocumentLine', () => {
  it('fromArray maps fields correctly', () => {
    const line = ProviderDocumentLine.fromArray({
      id: 42,
      vat_uid: 'ATU12345678',
      row_number: 1,
      entry_identifier: 'EID-001',
      reference: 'REF-001',
      meta: { key: 'value' },
    });
    expect(line).not.toBeNull();
    expect(line!.id).toBe(42);
    expect(line!.vatUid).toBe('ATU12345678');
    expect(line!.rowNumber).toBe(1);
    expect(line!.entryIdentifier).toBe('EID-001');
    expect(line!.reference).toBe('REF-001');
    expect(line!.meta).toEqual({ key: 'value' });
  });

  it('fromArray returns null for null/invalid input', () => {
    expect(ProviderDocumentLine.fromArray(null)).toBeNull();
    expect(ProviderDocumentLine.fromArray(undefined)).toBeNull();
  });

  it('toArray serializes correctly', () => {
    const line = ProviderDocumentLine.fromArray({ id: 1, vat_uid: 'DE123' });
    const arr = line!.toArray();
    expect(arr['id']).toBe(1);
    expect(arr['vat_uid']).toBe('DE123');
  });
});

describe('ProviderDocument', () => {
  it('fromArray maps fields correctly', () => {
    const doc = ProviderDocument.fromArray({
      id: 1,
      provider: 'vies',
      document_type: 'VAT_REGISTER',
      state: 'active',
      document_date: '2024-01-15',
      mime: 'application/pdf',
      size: 12345,
      hash: 'abc123',
      meta: { source: 'eu' },
    });
    expect(doc).not.toBeNull();
    expect(doc!.id).toBe(1);
    expect(doc!.provider).toBe('vies');
    expect(doc!.documentType).toBe('VAT_REGISTER');
    expect(doc!.documentDate).toBeInstanceOf(Date);
    expect(doc!.mime).toBe('application/pdf');
    expect(doc!.size).toBe(12345);
    expect(doc!.hash).toBe('abc123');
    expect(doc!.meta).toEqual({ source: 'eu' });
  });

  it('fromArray returns null for null/invalid input', () => {
    expect(ProviderDocument.fromArray(null)).toBeNull();
    expect(ProviderDocument.fromArray(undefined)).toBeNull();
  });

  it('fromArray maps nested line', () => {
    const doc = ProviderDocument.fromArray({
      id: 1,
      line: { id: 99, vat_uid: 'ATU12345678' },
    });
    expect(doc!.line).toBeInstanceOf(ProviderDocumentLine);
    expect(doc!.line!.id).toBe(99);
  });

  it('toArray serializes correctly', () => {
    const doc = ProviderDocument.fromArray({
      id: 5,
      provider: 'vies',
      document_date: '2024-06-01',
    });
    const arr = doc!.toArray();
    expect(arr['id']).toBe(5);
    expect(arr['provider']).toBe('vies');
    expect(typeof arr['document_date']).toBe('string');
  });
});

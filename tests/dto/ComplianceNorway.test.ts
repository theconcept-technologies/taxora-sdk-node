import { describe, it, expect } from 'vitest';
import { ComplianceEnrollment } from '../../src/dto/ComplianceEnrollment.js';
import { ComplianceTransaction } from '../../src/dto/ComplianceTransaction.js';
import { PeppolLookupResult } from '../../src/dto/PeppolLookupResult.js';
import { RegistryCompany } from '../../src/dto/RegistryCompany.js';
import { ComplianceDocumentType } from '../../src/enums/ComplianceDocumentType.js';
import { ComplianceService } from '../../src/enums/ComplianceService.js';
import { PeppolLookupStatus } from '../../src/enums/PeppolLookupStatus.js';

describe('ComplianceEnrollment.service', () => {
  it('parses the service and falls back to unknown for older servers', () => {
    expect(ComplianceEnrollment.fromArray({ service: 'e_invoicing' }).service).toBe(ComplianceService.E_INVOICING);
    expect(ComplianceEnrollment.fromArray({}).service).toBe(ComplianceService.UNKNOWN);
  });
});

describe('ComplianceTransaction e-invoicing fields', () => {
  it('defaults every new field when an older server omits them', () => {
    const tx = ComplianceTransaction.fromArray({ id: 1 });
    expect(tx.counterpartyRegisterId).toBeNull();
    expect(tx.counterpartyAddress).toBeNull();
    expect(tx.counterpartyCity).toBeNull();
    expect(tx.counterpartyPostalcode).toBeNull();
    expect(tx.counterpartyEmail).toBeNull();
    expect(tx.buyerReference).toBeNull();
    expect(tx.documentType).toBe(ComplianceDocumentType.INVOICE);
    expect(tx.isCreditNote).toBe(false);
    expect(tx.amendedNumber).toBeNull();
    expect(tx.amendedDate).toBeNull();
    expect(tx.providerState).toBeNull();
    expect(tx.invoiceLines).toEqual([]);
  });

  it('parses credit notes, provider state and stored invoice lines', () => {
    const tx = ComplianceTransaction.fromArray({
      document_type: 'credit_note',
      amended_number: 'INV-1',
      amended_date: '2026-09-01',
      provider_state: 'accepted',
      provider_payload: {
        invoice: {
          invoice_lines_attributes: [
            {
              description: 'Consulting',
              quantity: '2',
              price: 1000.5,
              unit: 9,
              taxes_attributes: [{ name: 'MVA', percent: 25, category: 'S' }, 'garbage'],
            },
            'garbage',
            { quantity: 'n/a', taxes_attributes: null },
          ],
        },
      },
    });

    expect(tx.documentType).toBe(ComplianceDocumentType.CREDIT_NOTE);
    expect(tx.isCreditNote).toBe(true);
    expect(tx.amendedNumber).toBe('INV-1');
    expect(tx.amendedDate).toBe('2026-09-01');
    expect(tx.providerState).toBe('accepted');
    expect(tx.invoiceLines).toEqual([
      {
        description: 'Consulting',
        quantity: 2,
        price: '1000.5',
        unit: 9,
        taxes: [{ name: 'MVA', percent: 25, category: 'S', comment: null }],
      },
      { description: '', quantity: null, price: '0.00', unit: null, taxes: [] },
    ]);
  });

  it('maps an unrecognized document type to unknown and tolerates a malformed payload', () => {
    const tx = ComplianceTransaction.fromArray({ document_type: 'receipt', provider_payload: [] });
    expect(tx.documentType).toBe(ComplianceDocumentType.UNKNOWN);
    expect(tx.invoiceLines).toEqual([]);
  });
});

describe('RegistryCompany', () => {
  it('maps a full row', () => {
    const company = RegistryCompany.fromArray({
      org_number: '923609016',
      company_name: 'EQUINOR ASA',
      organisation_form: 'ASA',
      vat_registered: true,
      vat_number: 'NO923609016MVA',
      enterprise_register: true,
      bankrupt: false,
      under_liquidation: false,
      address: 'Forusbeen 50',
      postalcode: '4035',
      city: 'STAVANGER',
      country: 'NO',
    });
    expect(company.orgNumber).toBe('923609016');
    expect(company.companyName).toBe('EQUINOR ASA');
    expect(company.organisationForm).toBe('ASA');
    expect(company.vatRegistered).toBe(true);
    expect(company.vatNumber).toBe('NO923609016MVA');
    expect(company.enterpriseRegister).toBe(true);
    expect(company.bankrupt).toBe(false);
    expect(company.underLiquidation).toBe(false);
    expect(company.address).toBe('Forusbeen 50');
    expect(company.postalcode).toBe('4035');
    expect(company.city).toBe('STAVANGER');
    expect(company.country).toBe('NO');
  });

  it('defaults missing fields', () => {
    const company = RegistryCompany.fromArray({});
    expect(company.orgNumber).toBe('');
    expect(company.vatNumber).toBeNull();
    expect(company.vatRegistered).toBe(false);
    expect(company.organisationForm).toBeNull();
  });
});

describe('PeppolLookupResult', () => {
  it('maps a reachable result', () => {
    const result = PeppolLookupResult.fromArray({
      status: 'reachable',
      reachable: true,
      country: 'NO',
      scheme: '0192',
      id: '923609016',
      document_types: ['xml.ubl.invoice.bis3', 42],
      transport_type_code: 'peppol',
      checked_at: '2026-09-25T10:00:00+00:00',
    });
    expect(result.status).toBe(PeppolLookupStatus.REACHABLE);
    expect(result.reachable).toBe(true);
    expect(result.isPending).toBe(false);
    expect(result.documentTypes).toEqual(['xml.ubl.invoice.bis3']);
    expect(result.transportTypeCode).toBe('peppol');
    expect(result.checkedAt).toBe('2026-09-25T10:00:00+00:00');
  });

  it('maps a pending result with null reachability and defaults', () => {
    const result = PeppolLookupResult.fromArray({ status: 'pending', reachable: null });
    expect(result.status).toBe(PeppolLookupStatus.PENDING);
    expect(result.isPending).toBe(true);
    expect(result.reachable).toBeNull();
    expect(result.documentTypes).toEqual([]);
    expect(result.transportTypeCode).toBeNull();
    expect(result.checkedAt).toBeNull();
  });
});

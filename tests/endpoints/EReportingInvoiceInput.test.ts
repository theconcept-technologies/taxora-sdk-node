import { describe, it, expect } from 'vitest';
import { EReportingEndpoint, type CreateComplianceTransactionInput } from '../../src/endpoints/EReportingEndpoint.js';
import { calculateInvoiceTotals } from '../../src/support/calculateInvoiceTotals.js';
import { parseComplianceTaxCategory } from '../../src/enums/ComplianceTaxCategory.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';

const BASE_URL = 'https://sandbox.taxora.io/v1';

function makeEndpoint(responses: Response[] = []) {
  const storage = new InMemoryTokenStorage();
  storage.set(new Token('test-token', 'Bearer', new Date(Date.now() + 3600_000)));
  const client = new SequenceHttpClient(responses);
  return { endpoint: new EReportingEndpoint(BASE_URL, 'test-api-key', storage, client), client };
}

function input(overrides: Partial<CreateComplianceTransactionInput> = {}): CreateComplianceTransactionInput {
  return {
    complianceEnrollmentId: 21,
    transactionType: 'b2b_domestic_outbound',
    invoiceNumber: 'NO-2',
    invoiceDate: '2027-01-04',
    currency: 'NOK',
    subtotal: 1000,
    taxAmount: 250,
    total: 1250,
    counterpartyName: 'Kunde AS',
    counterpartyRegisterId: '923609016',
    invoiceLines: [
      { description: 'Vare', quantity: 1, price: 1000, taxes: [{ name: 'MVA', percent: 25, category: 'S' }] },
    ],
    ...overrides,
  };
}

const created = () =>
  SequenceHttpClient.jsonResponse(
    {
      success: true,
      data: {
        id: 1,
        compliance_enrollment_id: 21,
        country: 'no',
        regime: 'peppol_bis3',
        transaction_type: 'b2b_domestic_outbound',
        state: 'submitted',
        invoice_number: 'NO-2',
        currency: 'NOK',
      },
    },
    201,
  );

describe('invoice input that cannot be right is refused before a request', () => {
  it('upper-cases currency and country and accepts lower-case tax categories', async () => {
    const { endpoint, client } = makeEndpoint([created()]);

    await endpoint.createTransaction(
      input({
        currency: 'nok',
        counterpartyCountry: 'no',
        invoiceLines: [
          { description: 'Vare', quantity: 1, price: 1000, taxes: [{ name: 'MVA', percent: 25, category: 's' }] },
        ],
      }),
    );

    const body = JSON.parse(client.requests[0]!.options?.body as string);
    expect(body.currency).toBe('NOK');
    expect(body.counterparty_country).toBe('NO');
    expect(body.invoice_lines_attributes[0].taxes_attributes[0].category).toBe('S');
  });

  it.each([
    [
      'an unknown tax category',
      {
        invoiceLines: [
          { description: 'x', quantity: 1, price: 1, taxes: [{ name: 'MVA', percent: 25, category: 'X' as never }] },
        ],
      },
      'category "X" is unknown. Valid: S, AA, AAA, K, G, AE, E, Z.',
    ],
    [
      'an exempt tax without the exemption code',
      {
        invoiceLines: [
          { description: 'x', quantity: 1, price: 1, taxes: [{ name: 'MVA', percent: 0, category: 'E' as const }] },
        ],
      },
      'exemption code (VATEX)',
    ],
    [
      'a percent above 100',
      {
        invoiceLines: [
          { description: 'x', quantity: 1, price: 1, taxes: [{ name: 'MVA', percent: 250, category: 'S' as const }] },
        ],
      },
      'percent must be between 0 and 100',
    ],
    ['a currency with digits', { currency: 'N0K' }, 'three letters'],
    ['a country with three letters', { counterpartyCountry: 'NOR' }, 'two letters'],
    ['a due date before the invoice date', { dueDate: '2027-01-01' }, 'dueDate must not be before'],
    ['a credit note without reference', { isCreditNote: true }, 'needs amendedNumber'],
    ['a reference without credit note', { amendedNumber: 'NO-1' }, 'only for credit notes'],
    ['a credit note reusing its number', { isCreditNote: true, amendedNumber: 'NO-2' }, 'cannot reuse'],
    [
      'a corrected invoice dated later',
      { isCreditNote: true, amendedNumber: 'NO-1', amendedDate: '2027-02-01' },
      'must not be after',
    ],
  ])('rejects %s', async (_name, override, message) => {
    const { endpoint, client } = makeEndpoint();

    await expect(
      endpoint.createTransaction(input(override as Partial<CreateComplianceTransactionInput>)),
    ).rejects.toThrow(message);
    expect(client.requests).toHaveLength(0);
  });

  it('accepts an exempt tax with its exemption code', async () => {
    const { endpoint } = makeEndpoint([created()]);

    await expect(
      endpoint.createTransaction(
        input({
          invoiceLines: [
            {
              description: 'x',
              quantity: 1,
              price: 1000,
              taxes: [{ name: 'MVA', percent: 0, category: 'E', comment: 'vatex-eu-132' }],
            },
          ],
          taxAmount: 0,
          total: 1000,
        }),
      ),
    ).resolves.toBeDefined();
  });
});

describe('calculateInvoiceTotals', () => {
  it('computes subtotal, VAT and total the way the e-invoice is built', () => {
    const totals = calculateInvoiceTotals([
      { description: 'Chair', quantity: 3, price: 111.11, taxes: [{ name: 'MVA', percent: 25, category: 'S' }] },
      { description: 'Book', quantity: 2, price: 10, taxes: [{ name: 'MVA', percent: 12, category: 'S' }] },
      { description: 'Export', quantity: 1, price: 5, taxes: [{ name: 'MVA', percent: 0, category: 'Z' }] },
    ]);

    expect(totals).toEqual({ subtotal: 358.33, taxAmount: 85.73, total: 444.06 });
  });
});

describe('parseComplianceTaxCategory', () => {
  it('accepts any case and refuses unknown codes', () => {
    expect(parseComplianceTaxCategory('ae')).toBe('AE');
    expect(parseComplianceTaxCategory(' z ')).toBe('Z');
    expect(parseComplianceTaxCategory('X')).toBeNull();
    expect(parseComplianceTaxCategory(25)).toBeNull();
  });
});

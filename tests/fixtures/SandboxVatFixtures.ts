import { VatState } from '../../src/enums/VatState.js';

export interface SandboxVatFixture {
  vatUid: string;
  companyName: string;
  address: string;
}

export class SandboxVatFixtures {
  static valid(): SandboxVatFixture[] {
    return [
      {
        vatUid: 'ATU12345678',
        companyName: 'Alpha Handels GmbH',
        address: 'Ringstraße 1, 1010, Wien, AT',
      },
      {
        vatUid: 'DE123456789',
        companyName: 'Beta Technik GmbH',
        address: 'Hauptstraße 12, 10115, Berlin, DE',
      },
      {
        vatUid: 'FR99345678901',
        companyName: 'Gamma Industrie SAS',
        address: '10 Rue de Rivoli, 75001, Paris, FR',
      },
      {
        vatUid: 'IT12398765432',
        companyName: 'Delta Servizi SRL',
        address: 'Via Roma 25, 00100, Roma, IT',
      },
      {
        vatUid: 'GB999999973',
        companyName: 'Epsilon Solutions Ltd',
        address: '221B Baker Street, NW1 6XE, London, GB',
      },
    ];
  }

  static invalid(): string[] {
    return [
      'ATU99999999',
      'DE000000000',
      'FR00000000000',
      'IT00000000000',
      'GB000000000',
    ];
  }

  static byState(): Record<string, SandboxVatFixture[] | string[]> {
    return {
      [VatState.VALID]: SandboxVatFixtures.valid(),
      [VatState.INVALID]: SandboxVatFixtures.invalid().map((vatUid) => ({
        vatUid,
        companyName: '',
        address: '',
      })),
    };
  }
}

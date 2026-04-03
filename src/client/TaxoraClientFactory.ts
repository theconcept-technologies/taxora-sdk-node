import { TaxoraClient, TaxoraClientOptions } from './TaxoraClient.js';

export class TaxoraClientFactory {
  static create(options: TaxoraClientOptions): TaxoraClient {
    return new TaxoraClient(options);
  }
}

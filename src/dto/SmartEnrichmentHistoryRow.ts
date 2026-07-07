import { SmartEnrichmentResource } from './SmartEnrichmentResource.js';
import { type SmartEnrichmentStatus, toSmartEnrichmentStatus } from '../enums/SmartEnrichmentStatus.js';

/**
 * Full first input of a history row (incl. street + postalCode) — everything that was
 * queried, so a detail view needs no second fetch. `query` stays the compact summary.
 */
export interface SmartEnrichmentHistoryInput {
  companyName: string | undefined;
  street: string | undefined;
  postalCode: string | undefined;
  city: string | undefined;
  country: string | undefined;
}

/**
 * One row of Smart Enrichment lookup history (compact summary; full detail via getJob).
 */
export class SmartEnrichmentHistoryRow {
  constructor(
    public readonly jobId: string,
    public readonly status: SmartEnrichmentStatus,
    public readonly isBulk: boolean,
    public readonly itemCount: number,
    public readonly foundCount: number,
    public readonly queryCompanyName: string | undefined,
    public readonly queryCountry: string | undefined,
    public readonly queryCity: string | undefined,
    public readonly input: SmartEnrichmentHistoryInput | undefined,
    public readonly result: SmartEnrichmentResource | undefined,
    public readonly createdAt: string | undefined,
    public readonly finishedAt: string | undefined,
  ) {}

  static fromArray(data: Record<string, unknown>): SmartEnrichmentHistoryRow {
    const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
    const query =
      data['query'] !== null && typeof data['query'] === 'object' && !Array.isArray(data['query'])
        ? (data['query'] as Record<string, unknown>)
        : {};
    const inputRaw =
      data['input'] !== null && typeof data['input'] === 'object' && !Array.isArray(data['input'])
        ? (data['input'] as Record<string, unknown>)
        : undefined;
    const input: SmartEnrichmentHistoryInput | undefined = inputRaw
      ? {
          companyName: str(inputRaw['companyName']),
          street: str(inputRaw['street']),
          postalCode: str(inputRaw['postalCode']),
          city: str(inputRaw['city']),
          country: str(inputRaw['country']),
        }
      : undefined;
    const result =
      data['result'] !== null && typeof data['result'] === 'object' && !Array.isArray(data['result'])
        ? SmartEnrichmentResource.fromArray(data['result'] as Record<string, unknown>)
        : undefined;

    return new SmartEnrichmentHistoryRow(
      str(data['jobId']) ?? '',
      toSmartEnrichmentStatus(data['status']),
      data['isBulk'] === true,
      typeof data['itemCount'] === 'number' ? data['itemCount'] : 0,
      typeof data['foundCount'] === 'number' ? data['foundCount'] : 0,
      str(query['companyName']),
      str(query['country']),
      str(query['city']),
      input,
      result,
      str(data['createdAt']),
      str(data['finishedAt']),
    );
  }
}

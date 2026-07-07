import { SmartEnrichmentResource } from './SmartEnrichmentResource.js';
import { SmartEnrichmentStatus, toSmartEnrichmentStatus } from '../enums/SmartEnrichmentStatus.js';

/**
 * A Smart Enrichment job — single lookup or bulk batch. Unifies the API's sync and async
 * responses: a confident single lookup comes back already resolved (one result, status
 * `found`); everything else comes back `processing` with a `jobId` to poll.
 */
export class SmartEnrichmentJob {
  constructor(
    public readonly jobId: string,
    public readonly status: SmartEnrichmentStatus,
    public readonly itemCount: number | undefined,
    public readonly completedCount: number | undefined,
    public readonly foundCount: number | undefined,
    public readonly results: SmartEnrichmentResource[],
  ) {}

  static fromArray(data: Record<string, unknown>): SmartEnrichmentJob {
    const num = (key: string): number | undefined => {
      const v = data[key];
      return typeof v === 'number' ? v : undefined;
    };

    let results: SmartEnrichmentResource[] = [];

    if (Array.isArray(data['results'])) {
      // Bulk job: array of per-item results.
      results = (data['results'] as unknown[])
        .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
        .map(SmartEnrichmentResource.fromArray);
    } else if (data['vatNumber'] !== undefined || SmartEnrichmentJob.looksLikeItem(data['status'])) {
      // Flat single response — the payload itself is the (only) result.
      results = [SmartEnrichmentResource.fromArray(data)];
    }

    return new SmartEnrichmentJob(
      typeof data['jobId'] === 'string' ? data['jobId'] : '',
      toSmartEnrichmentStatus(data['status']),
      num('itemCount'),
      num('completedCount'),
      num('foundCount'),
      results,
    );
  }

  isProcessing(): boolean {
    return this.status === SmartEnrichmentStatus.PROCESSING || this.status === SmartEnrichmentStatus.QUEUED;
  }

  /** Convenience for single lookups: the first (or only) result, if any. */
  result(): SmartEnrichmentResource | undefined {
    return this.results[0];
  }

  private static looksLikeItem(status: unknown): boolean {
    const s = toSmartEnrichmentStatus(status);
    return (
      s === SmartEnrichmentStatus.FOUND ||
      s === SmartEnrichmentStatus.NO_VAT_EXISTS ||
      s === SmartEnrichmentStatus.NOT_FOUND
    );
  }
}

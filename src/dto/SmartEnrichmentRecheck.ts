/** Why a row was left out of a recheck. */
export type SmartEnrichmentRecheckSkipReason =
  'resolved' | 'no_vat_exists' | 'limit_reached' | 'cooldown' | 'running' | 'pending';

export type SmartEnrichmentRecheckRunState = 'queued' | 'running' | 'finished' | 'failed';

export interface SmartEnrichmentRecheckRun {
  state: SmartEnrichmentRecheckRunState;
  /** Set once a finished recheck found a usable number (`true`) or did not (`false`). */
  resolved?: boolean;
}

export interface SmartEnrichmentRecheckOptions {
  /** 0-based row indexes of the lookup; omit to recheck every row that qualifies. */
  rows?: number[];
  /** Only report which rows would run and what they cost — nothing is started. */
  dryRun?: boolean;
}

const toIndexes = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number' && Number.isInteger(v)) : [];

/**
 * What a recheck started (or, for a dry run, would start) and what it costs. Every recheck counts
 * as a check like a new lookup (Deep Verify ×2), whether a VAT number is found or not.
 */
export class SmartEnrichmentRecheck {
  constructor(
    public readonly jobId: string,
    /** Row indexes that are (or would be) rechecked. */
    public readonly rows: number[],
    /** Checks these rechecks use. */
    public readonly checks: number,
    /** Rows left out, by reason. */
    public readonly skipped: Partial<Record<SmartEnrichmentRecheckSkipReason, number>>,
    public readonly dryRun: boolean,
  ) {}

  static fromArray(data: Record<string, unknown>): SmartEnrichmentRecheck {
    const skipped: Partial<Record<SmartEnrichmentRecheckSkipReason, number>> = {};
    const rawSkipped = data['skipped'];
    if (typeof rawSkipped === 'object' && rawSkipped !== null && !Array.isArray(rawSkipped)) {
      for (const [reason, count] of Object.entries(rawSkipped as Record<string, unknown>)) {
        if (typeof count === 'number') skipped[reason as SmartEnrichmentRecheckSkipReason] = count;
      }
    }

    return new SmartEnrichmentRecheck(
      typeof data['jobId'] === 'string' ? data['jobId'] : '',
      toIndexes(data['rows']),
      typeof data['checks'] === 'number' ? data['checks'] : 0,
      skipped,
      data['dryRun'] === true,
    );
  }
}

/**
 * "Check again" state of a lookup, as `smartEnrichment.get()` reports it: the rows that can be
 * rechecked right now, the rechecks of the last week, and the limits behind both.
 */
export class SmartEnrichmentRecheckState {
  constructor(
    /** Row indexes that can be rechecked now. */
    public readonly eligible: number[],
    /** Rechecks of the last week, by row index. */
    public readonly runs: Record<number, SmartEnrichmentRecheckRun>,
    public readonly maxPerRow: number,
    public readonly cooldownDays: number,
  ) {}

  static fromArray(data: Record<string, unknown>): SmartEnrichmentRecheckState {
    const runs: Record<number, SmartEnrichmentRecheckRun> = {};
    const rawRuns = data['runs'];
    if (typeof rawRuns === 'object' && rawRuns !== null && !Array.isArray(rawRuns)) {
      for (const [index, run] of Object.entries(rawRuns as Record<string, unknown>)) {
        if (!/^\d+$/.test(index) || typeof run !== 'object' || run === null) continue;
        const { state, resolved } = run as Record<string, unknown>;
        if (state !== 'queued' && state !== 'running' && state !== 'finished' && state !== 'failed') continue;
        runs[Number(index)] = typeof resolved === 'boolean' ? { state, resolved } : { state };
      }
    }

    return new SmartEnrichmentRecheckState(
      toIndexes(data['eligible']),
      runs,
      typeof data['maxPerRow'] === 'number' ? data['maxPerRow'] : 3,
      typeof data['cooldownDays'] === 'number' ? data['cooldownDays'] : 7,
    );
  }

  /** True while any recheck of this lookup is queued or running. */
  isActive(): boolean {
    return Object.values(this.runs).some((run) => run.state === 'queued' || run.state === 'running');
  }
}

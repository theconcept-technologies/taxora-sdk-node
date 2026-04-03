export class ScoreBreakdown {
  constructor(
    public readonly stepName: string,
    public readonly scoreContribution: number,
    public readonly metadata: Record<string, unknown>,
  ) {}

  static fromArray(data: Record<string, unknown>): ScoreBreakdown {
    return new ScoreBreakdown(
      typeof data['step_name'] === 'string' ? data['step_name'] : '',
      typeof data['score_contribution'] === 'number' ? data['score_contribution'] : 0,
      data['metadata'] !== null && typeof data['metadata'] === 'object' && !Array.isArray(data['metadata'])
        ? (data['metadata'] as Record<string, unknown>)
        : {},
    );
  }

  toArray(): { step_name: string; score_contribution: number; metadata: Record<string, unknown> } {
    return {
      step_name: this.stepName,
      score_contribution: this.scoreContribution,
      metadata: this.metadata,
    };
  }
}

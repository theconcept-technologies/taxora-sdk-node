import { describe, it, expect } from 'vitest';
import { ScoreBreakdown } from '../../src/dto/ScoreBreakdown.js';

describe('ScoreBreakdown', () => {
  it('fromArray maps fields correctly', () => {
    const breakdown = ScoreBreakdown.fromArray({
      step_name: 'name_match',
      score_contribution: 0.75,
      metadata: { matched: true },
    });
    expect(breakdown.stepName).toBe('name_match');
    expect(breakdown.scoreContribution).toBe(0.75);
    expect(breakdown.metadata).toEqual({ matched: true });
  });

  it('fromArray defaults missing fields', () => {
    const breakdown = ScoreBreakdown.fromArray({});
    expect(breakdown.stepName).toBe('');
    expect(breakdown.scoreContribution).toBe(0);
    expect(breakdown.metadata).toEqual({});
  });

  it('toArray serializes correctly', () => {
    const breakdown = new ScoreBreakdown('address_check', 0.5, { city: 'Vienna' });
    const arr = breakdown.toArray();
    expect(arr).toEqual({
      step_name: 'address_check',
      score_contribution: 0.5,
      metadata: { city: 'Vienna' },
    });
  });
});

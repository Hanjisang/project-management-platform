import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  businessDayEndInstant,
  businessDayStartInstant,
  businessToday,
  calculateChecklistProgress,
  calculateRiskScore,
  calculateWeightedProgress,
  deriveProjectHealth,
  normalizeWeights,
} from './index.js';

describe('domain calculations', () => {
  it.each([
    { label: 'one item', durations: [5], expected: [100] },
    { label: 'three equal items', durations: [1, 1, 1], expected: [34, 33, 33] },
    {
      label: 'seven equal items',
      durations: [1, 1, 1, 1, 1, 1, 1],
      expected: [15, 15, 14, 14, 14, 14, 14],
    },
    { label: 'unequal items', durations: [1, 2, 7], expected: [10, 20, 70] },
    { label: 'zero and negative durations', durations: [0, -2, 4], expected: [0, 0, 100] },
    {
      label: 'non-finite durations',
      durations: [Number.NaN, Number.POSITIVE_INFINITY, 0],
      expected: [34, 33, 33],
    },
  ])(
    'normalizes $label to deterministic integer weights totalling 100',
    ({ durations, expected }) => {
      const result = normalizeWeights(
        durations.map((durationDays, index) => ({ id: String(index), durationDays })),
      );
      expect(result.map((item) => item.weight)).toEqual(expected);
      expect(result.every((item) => Number.isInteger(item.weight))).toBe(true);
      expect(result.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    },
  );

  it('falls back to equal weights when every duration is unusable', () => {
    const result = normalizeWeights([
      { id: 'a', durationDays: 1 },
      { id: 'b', durationDays: -1 },
      { id: 'c', durationDays: Number.NaN },
    ]);
    expect(result.map((item) => item.weight)).toEqual([100, 0, 0]);
    expect(result.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
  });

  it('returns no weights for an empty collection', () => {
    expect(normalizeWeights([])).toEqual([]);
  });
  it('calculates checklist and weighted progress', () => {
    expect(calculateChecklistProgress([{ completed: true }, { completed: false }])).toBe(50);
    expect(
      calculateWeightedProgress([
        { id: 'a', weight: 40, progress: 100 },
        { id: 'b', weight: 60, progress: 50 },
      ]),
    ).toBe(70);
  });
  it('derives health from operational data', () => {
    expect(calculateRiskScore(4, 5)).toBe(20);
    expect(
      deriveProjectHealth({
        overdueTaskCount: 0,
        criticalIssueCount: 0,
        highIssueCount: 0,
        maxRiskScore: 20,
      }),
    ).toBe('HIGH_RISK');
  });
  it('uses the Asia/Shanghai business day for DATE comparisons', () => {
    const beforeMidnightUtc = new Date('2026-08-23T15:59:59.999Z');
    const afterMidnightShanghai = new Date('2026-08-23T16:00:00.000Z');
    expect(businessToday(beforeMidnightUtc).toISOString()).toBe('2026-08-23T00:00:00.000Z');
    const today = businessToday(afterMidnightShanghai);
    expect(today.toISOString()).toBe('2026-08-24T00:00:00.000Z');
    expect(addBusinessDays(today, 1).toISOString()).toBe('2026-08-25T00:00:00.000Z');
    expect(businessDayStartInstant(today).toISOString()).toBe('2026-08-23T16:00:00.000Z');
    expect(businessDayEndInstant(today).toISOString()).toBe('2026-08-24T15:59:59.999Z');
  });
});

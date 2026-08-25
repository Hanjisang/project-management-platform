import { describe, expect, it } from 'vitest';
import { classifyProjectChange } from './change-impact-classifier';

const start = new Date('2026-01-01T00:00:00Z');
const day = (offset: number) => new Date(start.getTime() + offset * 86_400_000);

describe('approved-baseline change impact', () => {
  it.each([
    [120, 'DIRECT_ADJUSTMENT'],
    [80, 'DIRECT_ADJUSTMENT'],
    [120.01, 'REQUIRES_CHANGE_REQUEST'],
    [79.99, 'REQUIRES_CHANGE_REQUEST'],
  ] as const)('classifies a 100-day baseline at %s days', (duration, classification) => {
    expect(
      classifyProjectChange({
        baselineStart: start,
        baselineCompletion: day(100),
        proposedCompletion: day(duration),
      }).classification,
    ).toBe(classification);
  });

  it('always compares against the approved baseline, preventing split adjustments', () => {
    expect(
      classifyProjectChange({
        baselineStart: start,
        baselineCompletion: day(100),
        proposedCompletion: day(110),
      }).classification,
    ).toBe('DIRECT_ADJUSTMENT');
    expect(
      classifyProjectChange({
        baselineStart: start,
        baselineCompletion: day(100),
        proposedCompletion: day(118),
      }).classification,
    ).toBe('DIRECT_ADJUSTMENT');
    expect(
      classifyProjectChange({
        baselineStart: start,
        baselineCompletion: day(100),
        proposedCompletion: day(121),
      }).classification,
    ).toBe('REQUIRES_CHANGE_REQUEST');
  });

  it('always requires approval for scope change', () => {
    expect(
      classifyProjectChange({
        baselineStart: start,
        baselineCompletion: day(100),
        proposedCompletion: day(100),
        scopeChange: true,
      }).classification,
    ).toBe('REQUIRES_CHANGE_REQUEST');
  });
});

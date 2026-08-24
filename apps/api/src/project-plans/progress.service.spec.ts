import { describe, expect, it } from 'vitest';
import { calculateRequiredProgress } from './progress.service';

describe('required WorkItem progress formula', () => {
  it.each([
    ['one incomplete checklist', [{ required: true, completed: false }], [], 0],
    ['one completed checklist', [{ required: true, completed: true }], [], 100],
    ['unsubmitted deliverable', [], [{ required: true, progressContribution: 0 as const }], 0],
    ['uploaded deliverable', [], [{ required: true, progressContribution: 0.5 as const }], 50],
    ['approved deliverable', [], [{ required: true, progressContribution: 1 as const }], 100],
    ['AI rejected deliverable', [], [{ required: true, progressContribution: 0.5 as const }], 50],
    [
      'human rejected deliverable',
      [],
      [{ required: true, progressContribution: 0.5 as const }],
      50,
    ],
    [
      'needs-revision deliverable',
      [],
      [{ required: true, progressContribution: 0.5 as const }],
      50,
    ],
  ])('%s', (_name, checklist, deliverables, expected) => {
    expect(calculateRequiredProgress(checklist, deliverables, 17)).toBe(expected);
  });

  it('excludes optional checklist and deliverables', () => {
    expect(
      calculateRequiredProgress(
        [
          { required: true, completed: true },
          { required: false, completed: false },
        ],
        [{ required: false, progressContribution: 0 }],
        0,
      ),
    ).toBe(100);
  });

  it('computes a mixed required result exactly', () => {
    expect(
      calculateRequiredProgress(
        [
          { required: true, completed: true },
          { required: true, completed: false },
        ],
        [
          { required: true, progressContribution: 0.5 },
          { required: true, progressContribution: 1 },
        ],
        0,
      ),
    ).toBe(63);
  });

  it('keeps manual progress when there are no required units', () => {
    expect(calculateRequiredProgress([], [], 37)).toBe(37);
  });
});

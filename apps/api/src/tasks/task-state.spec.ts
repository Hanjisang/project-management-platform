import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertTaskDates, normalizeTaskUpdate } from './task-state';

describe('Task state rules', () => {
  it('requires the dedicated completion action for DONE or 100% updates', () => {
    expect(() =>
      normalizeTaskUpdate({ status: 'IN_PROGRESS', progress: 80 }, { status: 'DONE' }),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeTaskUpdate({ status: 'IN_PROGRESS', progress: 80 }, { progress: 100 }),
    ).toThrow(BadRequestException);
  });

  it('reopens DONE tasks consistently and clears completion state', () => {
    expect(normalizeTaskUpdate({ status: 'DONE', progress: 100 }, { status: 'TODO' })).toEqual({
      progress: 99,
      completedAt: null,
    });
    expect(
      normalizeTaskUpdate(
        { status: 'DONE', progress: 100 },
        { status: 'IN_PROGRESS', progress: 60 },
      ),
    ).toEqual({ progress: 60, completedAt: null });
  });

  it('preserves progress while cancelling and never marks cancellation completed', () => {
    expect(
      normalizeTaskUpdate({ status: 'IN_PROGRESS', progress: 45 }, { status: 'CANCELLED' }),
    ).toEqual({ progress: undefined, completedAt: null });
  });

  it('rejects invalid create and partial-update date combinations', () => {
    const start = new Date('2026-08-25');
    const due = new Date('2026-08-24');
    expect(() => assertTaskDates(start, due)).toThrow(BadRequestException);
    expect(() => assertTaskDates(due, start)).not.toThrow();
  });
});

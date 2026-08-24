import { describe, expect, it } from 'vitest';
import { aiAnalysisSchema } from './analysis.schema';

describe('AI analysis validation', () => {
  it('rejects out-of-range progress and unknown fields', () => {
    const result = aiAnalysisSchema.safeParse({
      project: { id: null, name: '', confidence: 0 },
      summary: '',
      progressUpdates: [{ workItemId: 'x', progress: 101, evidence: '' }],
      issues: [],
      risks: [],
      tasks: [],
      decisions: [],
      followUps: [],
      invented: true,
    });
    expect(result.success).toBe(false);
  });
  it('accepts an empty strict extraction', () => {
    expect(
      aiAnalysisSchema.safeParse({
        project: { id: null, name: '', confidence: 0 },
        summary: '',
        progressUpdates: [],
        issues: [],
        risks: [],
        tasks: [],
        decisions: [],
        followUps: [],
      }).success,
    ).toBe(true);
  });
});

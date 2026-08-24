import { describe, expect, it } from 'vitest';
import { FakeAiProvider } from './fake-ai.provider';
import { projectChangeImpactSchema } from './project-change-impact.schema';

const input = {
  project: {
    id: 'p1',
    name: '项目',
    plannedStartDate: '2026-01-01',
    plannedCompletionDate: '2026-04-11',
  },
  baseline: {
    version: 1,
    plannedStartDate: '2026-01-01',
    plannedCompletionDate: '2026-04-11',
  },
  change: {
    title: '新增退费接口',
    description: '范围扩大',
    reason: '客户要求',
    changeType: 'SCOPE',
    operations: [{ operationType: 'ADD_WORK_ITEM', payload: { name: '退费接口' } }],
  },
};

describe('project change AI impact schema', () => {
  it('accepts the strict structured impact output from the test-only provider', async () => {
    const result = await new FakeAiProvider().analyzeProjectChange(input);
    expect(projectChangeImpactSchema.parse(result)).toEqual(result);
    expect(result.risks[0]?.severity).toBe('MEDIUM');
  });

  it('rejects unstructured or incomplete output', () => {
    expect(() => projectChangeImpactSchema.parse({ summary: 'only text' })).toThrow();
  });
});

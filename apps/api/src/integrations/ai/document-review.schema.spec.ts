import { describe, expect, it } from 'vitest';
import { BadGatewayException } from '@nestjs/common';
import { documentReviewSchema } from './document-review.schema';
import { FakeAiProvider } from './fake-ai.provider';
import { NotConfiguredAiProvider } from './not-configured-ai.provider';

const input = {
  project: { id: 'p1', name: 'Project' },
  deliverable: {
    name: '确认表',
    description: null,
    reviewMode: 'AI_WITH_HUMAN_OVERRIDE' as const,
    instruction: null,
    threshold: 85,
  },
  criteria: [{ id: 'c1', name: '完整', description: null, required: true, weight: 100 }],
  content: 'valid content',
};

describe('document AI review contracts', () => {
  it('accepts a strict structured response', () => {
    expect(
      documentReviewSchema.safeParse({
        decision: 'APPROVED',
        score: 95,
        summary: 'ok',
        criteriaResults: [{ criterionId: 'c1', passed: true, score: 95, explanation: 'ok' }],
        findings: [],
        suggestions: [],
      }).success,
    ).toBe(true);
  });

  it('rejects invalid JSON-shaped output', () => {
    expect(
      documentReviewSchema.safeParse({
        decision: 'YES',
        score: 101,
        summary: 'bad',
        criteriaResults: [],
        findings: [],
        suggestions: [],
        injected: true,
      }).success,
    ).toBe(false);
  });

  it('uses the deterministic fake provider only when explicitly constructed for tests', async () => {
    expect(await new FakeAiProvider().reviewDocument(input)).toEqual(
      expect.objectContaining({ decision: 'APPROVED', score: 95 }),
    );
  });

  it('returns a specific not-configured error without fabricated output', async () => {
    await expect(new NotConfiguredAiProvider().reviewDocument()).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AI_REVIEW_NOT_CONFIGURED' }),
    });
  });

  it('can model a provider schema failure as a gateway error', () => {
    const error = new BadGatewayException({ code: 'AI_RESPONSE_SCHEMA_INVALID' });
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'AI_RESPONSE_SCHEMA_INVALID' }),
    );
  });
});

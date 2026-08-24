import { describe, expect, it } from 'vitest';
import { DeliverableReviewDecisionService } from './deliverable-review-decision.service';

const now = new Date('2026-08-24T00:00:00Z');
const review = (
  reviewType: 'AI' | 'HUMAN',
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED',
  createdAt = now,
) => ({ reviewType, status, createdAt });
const input = (
  reviewMode: 'AI_WITH_HUMAN_OVERRIDE' | 'AI_THEN_HUMAN_REQUIRED' | 'HUMAN_ONLY',
  reviews: ReturnType<typeof review>[],
  needsRevision = false,
) => ({ reviewMode, needsRevision, documents: [{ versions: [{ createdAt: now, reviews }] }] });

describe('effective deliverable review decision', () => {
  const service = new DeliverableReviewDecisionService();

  it('lets AI approve in AI_WITH_HUMAN_OVERRIDE', () => {
    expect(
      service.decide(input('AI_WITH_HUMAN_OVERRIDE', [review('AI', 'APPROVED')])).effectiveStatus,
    ).toBe('APPROVED');
  });

  it('lets a newer human decision override AI', () => {
    expect(
      service.decide(
        input('AI_WITH_HUMAN_OVERRIDE', [
          review('AI', 'APPROVED'),
          review('HUMAN', 'REJECTED', new Date(now.getTime() + 1)),
        ]),
      ).effectiveStatus,
    ).toBe('REJECTED');
  });

  it('requires human approval in AI_THEN_HUMAN_REQUIRED', () => {
    expect(
      service.decide(input('AI_THEN_HUMAN_REQUIRED', [review('AI', 'APPROVED')])).effectiveStatus,
    ).toBe('HUMAN_REVIEW_REQUIRED');
  });

  it('ignores AI as a final decision in HUMAN_ONLY', () => {
    expect(service.decide(input('HUMAN_ONLY', [review('AI', 'APPROVED')])).effectiveStatus).toBe(
      'HUMAN_REVIEW_REQUIRED',
    );
  });

  it('resets the effective decision when a newer version has no final review', () => {
    const decision = service.decide({
      reviewMode: 'AI_WITH_HUMAN_OVERRIDE',
      needsRevision: false,
      documents: [
        {
          versions: [
            {
              createdAt: new Date(now.getTime() + 1),
              reviews: [review('AI', 'PENDING', new Date(now.getTime() + 1))],
            },
            { createdAt: now, reviews: [review('AI', 'APPROVED')] },
          ],
        },
      ],
    });
    expect(decision.effectiveStatus).toBe('AI_PENDING');
    expect(decision.progressContribution).toBe(0.5);
  });
});

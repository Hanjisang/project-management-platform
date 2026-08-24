import { Injectable } from '@nestjs/common';
import type {
  DeliverableReviewMode,
  DocumentReviewType,
  DocumentVersionReviewStatus,
} from '@prisma/client';

export type EffectiveDeliverableStatus =
  | 'NOT_SUBMITTED'
  | 'AI_PENDING'
  | 'AI_REJECTED'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'REJECTED'
  | 'APPROVED'
  | 'NEEDS_REVISION'
  | 'AI_FAILED';
type Review = {
  reviewType: DocumentReviewType;
  status: DocumentVersionReviewStatus;
  createdAt: Date;
};
type DeliverableReviewInput = {
  reviewMode: DeliverableReviewMode;
  needsRevision: boolean;
  documents: Array<{ versions: Array<{ createdAt: Date; reviews: Review[] }> }>;
};
export type DeliverableDecision = {
  effectiveStatus: EffectiveDeliverableStatus;
  approved: boolean;
  progressContribution: 0 | 0.5 | 1;
  effectiveReview: Review | null;
};

@Injectable()
export class DeliverableReviewDecisionService {
  decide(deliverable: DeliverableReviewInput): DeliverableDecision {
    const latestVersion = deliverable.documents
      .flatMap((document) => document.versions)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!latestVersion)
      return {
        effectiveStatus: 'NOT_SUBMITTED',
        approved: false,
        progressContribution: 0,
        effectiveReview: null,
      };
    if (deliverable.needsRevision) return this.pending('NEEDS_REVISION', null);
    const human = [...latestVersion.reviews]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .find((review) => review.reviewType === 'HUMAN' && review.status !== 'PENDING');
    return this.fromFinalReview(human, 'HUMAN_REVIEW_REQUIRED');
  }

  private fromFinalReview(
    review: Review | undefined,
    pendingStatus: EffectiveDeliverableStatus,
  ): DeliverableDecision {
    if (review?.status === 'APPROVED') return this.approved(review);
    if (review?.status === 'REJECTED') return this.pending('REJECTED', review);
    return this.pending(pendingStatus, review ?? null);
  }

  private approved(review: Review): DeliverableDecision {
    return {
      effectiveStatus: 'APPROVED',
      approved: true,
      progressContribution: 1,
      effectiveReview: review,
    };
  }

  private pending(status: EffectiveDeliverableStatus, review: Review | null): DeliverableDecision {
    return {
      effectiveStatus: status,
      approved: false,
      progressContribution: 0.5,
      effectiveReview: review,
    };
  }
}

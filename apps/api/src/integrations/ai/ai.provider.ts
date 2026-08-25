import type { ValidatedAiAnalysis } from './analysis.schema';
import type { DocumentReviewInput, ValidatedDocumentReview } from './document-review.schema';
import type {
  ProjectChangeImpactInput,
  ValidatedProjectChangeImpact,
} from './project-change-impact.schema';

export interface AiProvider {
  analyze(
    content: string,
    projectContext?: { id: string; name: string },
  ): Promise<ValidatedAiAnalysis>;
  reviewDocument(input: DocumentReviewInput): Promise<ValidatedDocumentReview>;
  analyzeProjectChange(input: ProjectChangeImpactInput): Promise<ValidatedProjectChangeImpact>;
  status(): { configured: boolean; provider: string; model?: string };
}
export const AI_PROVIDER = Symbol('AI_PROVIDER');

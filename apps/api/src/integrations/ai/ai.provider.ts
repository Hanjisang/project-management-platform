import type { ValidatedAiAnalysis } from './analysis.schema';

export interface AiProvider {
  analyze(
    content: string,
    projectContext?: { id: string; name: string },
  ): Promise<ValidatedAiAnalysis>;
  status(): { configured: boolean; provider: string; model?: string };
}
export const AI_PROVIDER = Symbol('AI_PROVIDER');

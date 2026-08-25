import { z } from 'zod';

export const documentReviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED', 'NEEDS_HUMAN_REVIEW']),
    score: z.number().int().min(0).max(100),
    summary: z.string().max(10000),
    criteriaResults: z
      .array(
        z.object({
          criterionId: z.string(),
          passed: z.boolean(),
          score: z.number().int().min(0).max(100).optional(),
          explanation: z.string().max(5000),
        }),
      )
      .max(200),
    findings: z
      .array(
        z.object({
          criterionId: z.string().optional(),
          severity: z.enum(['INFO', 'WARNING', 'ERROR']),
          title: z.string().min(1).max(240),
          description: z.string().max(5000),
          suggestion: z.string().max(5000).optional(),
        }),
      )
      .max(200),
    suggestions: z.array(z.string().max(5000)).max(100),
  })
  .strict();

export type ValidatedDocumentReview = z.infer<typeof documentReviewSchema>;

export const documentReviewJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'score', 'summary', 'criteriaResults', 'findings', 'suggestions'],
  properties: {
    decision: { enum: ['APPROVED', 'REJECTED', 'NEEDS_HUMAN_REVIEW'] },
    score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    criteriaResults: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterionId', 'passed', 'explanation'],
        properties: {
          criterionId: { type: 'string' },
          passed: { type: 'boolean' },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          explanation: { type: 'string' },
        },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'title', 'description'],
        properties: {
          criterionId: { type: 'string' },
          severity: { enum: ['INFO', 'WARNING', 'ERROR'] },
          title: { type: 'string' },
          description: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
} as const;

export interface DocumentReviewInput {
  project: { id: string; name: string };
  deliverable: {
    name: string;
    description: string | null;
    reviewMode: string;
    instruction: string | null;
    threshold: number | null;
  };
  criteria: Array<{
    id: string;
    name: string;
    description: string | null;
    required: boolean;
    weight: number;
  }>;
  content: string;
}

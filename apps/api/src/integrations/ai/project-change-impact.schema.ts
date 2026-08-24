import { z } from 'zod';

export const projectChangeImpactSchema = z
  .object({
    summary: z.string().min(1).max(4000),
    scheduleImpact: z.string().min(1).max(2000),
    scopeImpact: z.string().min(1).max(2000),
    risks: z
      .array(
        z
          .object({
            severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
            title: z.string().min(1).max(240),
            mitigation: z.string().min(1).max(2000),
          })
          .strict(),
      )
      .max(20),
    recommendations: z.array(z.string().min(1).max(2000)).max(20),
  })
  .strict();

export type ValidatedProjectChangeImpact = z.infer<typeof projectChangeImpactSchema>;
export interface ProjectChangeImpactInput {
  project: { id: string; name: string; plannedStartDate: string; plannedCompletionDate: string };
  baseline: { version: number; plannedStartDate: string; plannedCompletionDate: string };
  change: {
    title: string;
    description: string;
    reason: string;
    changeType: string;
    operations: Array<{ operationType: string; entityId?: string; payload: object }>;
  };
}

export const projectChangeImpactJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'scheduleImpact', 'scopeImpact', 'risks', 'recommendations'],
  properties: {
    summary: { type: 'string' },
    scheduleImpact: { type: 'string' },
    scopeImpact: { type: 'string' },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'title', 'mitigation'],
        properties: {
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          title: { type: 'string' },
          mitigation: { type: 'string' },
        },
      },
    },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
} as const;

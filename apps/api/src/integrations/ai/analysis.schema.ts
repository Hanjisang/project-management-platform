import { z } from 'zod';

const severity = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const aiAnalysisSchema = z
  .object({
    project: z.object({
      id: z.string().nullable(),
      name: z.string(),
      confidence: z.number().min(0).max(1),
    }),
    summary: z.string().max(5000),
    progressUpdates: z
      .array(
        z.object({
          planTaskId: z.string(),
          progress: z.number().int().min(0).max(100),
          evidence: z.string().max(2000),
        }),
      )
      .max(50),
    issues: z
      .array(
        z.object({
          title: z.string().min(1).max(240),
          description: z.string().max(10000),
          severity,
        }),
      )
      .max(50),
    risks: z
      .array(
        z.object({
          title: z.string().min(1).max(240),
          description: z.string().max(10000),
          severity,
          probability: z.number().int().min(1).max(5),
          impact: z.number().int().min(1).max(5),
        }),
      )
      .max(50),
    tasks: z
      .array(
        z.object({
          title: z.string().min(1).max(240),
          description: z.string().max(10000),
          priority,
          dueDate: z.string().date().nullable(),
        }),
      )
      .max(50),
    decisions: z.array(z.object({ content: z.string().min(1).max(5000) })).max(50),
    followUps: z
      .array(
        z.object({ content: z.string().min(1).max(5000), dueDate: z.string().date().nullable() }),
      )
      .max(50),
  })
  .strict();

export type ValidatedAiAnalysis = z.infer<typeof aiAnalysisSchema>;

export const aiAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'project',
    'summary',
    'progressUpdates',
    'issues',
    'risks',
    'tasks',
    'decisions',
    'followUps',
  ],
  properties: {
    project: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'confidence'],
      properties: {
        id: { type: ['string', 'null'] },
        name: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    summary: { type: 'string' },
    progressUpdates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['planTaskId', 'progress', 'evidence'],
        properties: {
          planTaskId: { type: 'string' },
          progress: { type: 'integer', minimum: 0, maximum: 100 },
          evidence: { type: 'string' },
        },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'severity'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'severity', 'probability', 'impact'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          probability: { type: 'integer', minimum: 1, maximum: 5 },
          impact: { type: 'integer', minimum: 1, maximum: 5 },
        },
      },
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'priority', 'dueDate'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          dueDate: { type: ['string', 'null'], format: 'date' },
        },
      },
    },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['content'],
        properties: { content: { type: 'string' } },
      },
    },
    followUps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['content', 'dueDate'],
        properties: {
          content: { type: 'string' },
          dueDate: { type: ['string', 'null'], format: 'date' },
        },
      },
    },
  },
} as const;

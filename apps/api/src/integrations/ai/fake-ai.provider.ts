import type { AiProvider } from './ai.provider';
import type { ValidatedAiAnalysis } from './analysis.schema';

export class FakeAiProvider implements AiProvider {
  analyze(content: string, project?: { id: string; name: string }): Promise<ValidatedAiAnalysis> {
    return Promise.resolve({
      project: { id: project?.id ?? null, name: project?.name ?? '', confidence: project ? 1 : 0 },
      summary: content.slice(0, 200),
      progressUpdates: [],
      issues: content.includes('问题')
        ? [{ title: '消息中识别的问题', description: content, severity: 'MEDIUM' }]
        : [],
      risks: [],
      tasks: [{ title: '跟进消息事项', description: content, priority: 'MEDIUM', dueDate: null }],
      decisions: [],
      followUps: [],
    });
  }
  status() {
    return { configured: true, provider: 'fake-test', model: 'deterministic' };
  }
}

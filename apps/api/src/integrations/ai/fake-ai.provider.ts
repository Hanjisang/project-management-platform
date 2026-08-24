import type { AiProvider } from './ai.provider';
import type { ValidatedAiAnalysis } from './analysis.schema';
import type { DocumentReviewInput, ValidatedDocumentReview } from './document-review.schema';
import type {
  ProjectChangeImpactInput,
  ValidatedProjectChangeImpact,
} from './project-change-impact.schema';

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
  reviewDocument(input: DocumentReviewInput): Promise<ValidatedDocumentReview> {
    const rejected = input.content.includes('FAKE_REJECT');
    return Promise.resolve({
      decision: rejected ? 'REJECTED' : 'APPROVED',
      score: rejected ? 40 : 95,
      summary: rejected ? '测试提供者识别到不符合项' : '测试提供者审核通过',
      criteriaResults: input.criteria.map((criterion) => ({
        criterionId: criterion.id,
        passed: !rejected,
        score: rejected ? 40 : 95,
        explanation: rejected ? '测试不通过' : '测试通过',
      })),
      findings: rejected
        ? [
            {
              severity: 'ERROR',
              title: '测试不符合项',
              description: 'FAKE_REJECT',
              suggestion: '上传修订版本',
            },
          ]
        : [],
      suggestions: [],
    });
  }
  analyzeProjectChange(input: ProjectChangeImpactInput): Promise<ValidatedProjectChangeImpact> {
    return Promise.resolve({
      summary: `测试影响分析：${input.change.title}`,
      scheduleImpact: `基于批准基线 V${input.baseline.version} 评估计划变化`,
      scopeImpact: `${input.change.operations.length} 项结构化变更操作`,
      risks: [
        {
          severity: 'MEDIUM',
          title: '变更实施协调风险',
          mitigation: '审批后按事务应用并复核新基线',
        },
      ],
      recommendations: ['确认负责人、日期和验收标准后再应用'],
    });
  }
  status() {
    return { configured: true, provider: 'fake-test', model: 'deterministic' };
  }
}

import { BadGatewayException } from '@nestjs/common';
import {
  aiAnalysisJsonSchema,
  aiAnalysisSchema,
  type ValidatedAiAnalysis,
} from './analysis.schema';
import type { AiProvider } from './ai.provider';
import {
  documentReviewJsonSchema,
  documentReviewSchema,
  type DocumentReviewInput,
  type ValidatedDocumentReview,
} from './document-review.schema';
import {
  projectChangeImpactJsonSchema,
  projectChangeImpactSchema,
  type ProjectChangeImpactInput,
  type ValidatedProjectChangeImpact,
} from './project-change-impact.schema';

interface ResponsesApiResult {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}
  async analyze(
    content: string,
    projectContext?: { id: string; name: string },
  ): Promise<ValidatedAiAnalysis> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions:
          '你是医疗信息化实施项目助手。只提取消息中有证据的事项，信息缺失时保持空数组，不要猜测。',
        input: `项目上下文：${projectContext ? `${projectContext.name} (${projectContext.id})` : '未归属'}\n\n消息：${content}`,
        text: {
          format: {
            type: 'json_schema',
            name: 'message_analysis',
            strict: true,
            schema: aiAnalysisJsonSchema,
          },
        },
      }),
    });
    if (!response.ok)
      throw new BadGatewayException({
        code: 'AI_PROVIDER_ERROR',
        message: `AI 服务请求失败 (${response.status})`,
      });
    const payload = (await response.json()) as ResponsesApiResult;
    const text =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text')?.text;
    if (!text)
      throw new BadGatewayException({ code: 'AI_RESPONSE_EMPTY', message: 'AI 未返回可用结果' });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadGatewayException({
        code: 'AI_RESPONSE_INVALID_JSON',
        message: 'AI 返回的内容不是有效 JSON',
      });
    }
    const validated = aiAnalysisSchema.safeParse(parsed);
    if (!validated.success)
      throw new BadGatewayException({
        code: 'AI_RESPONSE_SCHEMA_INVALID',
        message: 'AI 返回的结构未通过校验',
        details: validated.error.issues,
      });
    return validated.data;
  }
  async reviewDocument(input: DocumentReviewInput): Promise<ValidatedDocumentReview> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions:
          '你是项目交付物审核助手。只能依据给定项目快照审核标准判断，不得添加不存在的要求。输出严格 JSON。',
        input: JSON.stringify(input),
        text: {
          format: {
            type: 'json_schema',
            name: 'document_review',
            strict: true,
            schema: documentReviewJsonSchema,
          },
        },
      }),
    });
    if (!response.ok)
      throw new BadGatewayException({
        code: 'AI_PROVIDER_ERROR',
        message: `AI 服务请求失败 (${response.status})`,
      });
    const payload = (await response.json()) as ResponsesApiResult;
    const text =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text')?.text;
    if (!text)
      throw new BadGatewayException({ code: 'AI_RESPONSE_EMPTY', message: 'AI 未返回可用结果' });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadGatewayException({
        code: 'AI_RESPONSE_INVALID_JSON',
        message: 'AI 返回的内容不是有效 JSON',
      });
    }
    const validated = documentReviewSchema.safeParse(parsed);
    if (!validated.success)
      throw new BadGatewayException({
        code: 'AI_RESPONSE_SCHEMA_INVALID',
        message: 'AI 审核结果结构未通过校验',
        details: validated.error.issues,
      });
    return validated.data;
  }
  async analyzeProjectChange(
    input: ProjectChangeImpactInput,
  ): Promise<ValidatedProjectChangeImpact> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions:
          '你是医疗信息化实施项目变更影响分析助手。仅依据给定批准基线和结构化变更操作评估，不得批准变更，也不得虚构事实。',
        input: JSON.stringify(input),
        text: {
          format: {
            type: 'json_schema',
            name: 'project_change_impact',
            strict: true,
            schema: projectChangeImpactJsonSchema,
          },
        },
      }),
    });
    if (!response.ok)
      throw new BadGatewayException({
        code: 'AI_PROVIDER_ERROR',
        message: `AI 服务请求失败 (${response.status})`,
      });
    const payload = (await response.json()) as ResponsesApiResult;
    const text =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text')?.text;
    if (!text)
      throw new BadGatewayException({ code: 'AI_RESPONSE_EMPTY', message: 'AI 未返回可用结果' });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadGatewayException({
        code: 'AI_RESPONSE_INVALID_JSON',
        message: 'AI 返回的内容不是有效 JSON',
      });
    }
    const validated = projectChangeImpactSchema.safeParse(parsed);
    if (!validated.success)
      throw new BadGatewayException({
        code: 'AI_RESPONSE_SCHEMA_INVALID',
        message: 'AI 项目变更影响结构未通过校验',
        details: validated.error.issues,
      });
    return validated.data;
  }
  status() {
    return { configured: true, provider: 'openai-compatible', model: this.model };
  }
}

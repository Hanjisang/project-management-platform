import { BadGatewayException } from '@nestjs/common';
import {
  aiAnalysisJsonSchema,
  aiAnalysisSchema,
  type ValidatedAiAnalysis,
} from './analysis.schema';
import type { AiProvider } from './ai.provider';

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
  status() {
    return { configured: true, provider: 'openai-compatible', model: this.model };
  }
}

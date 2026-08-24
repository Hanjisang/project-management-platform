import { ServiceUnavailableException } from '@nestjs/common';
import type { AiProvider } from './ai.provider';

export class NotConfiguredAiProvider implements AiProvider {
  analyze(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'AI 服务未配置' }),
    );
  }
  reviewDocument(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException({
        code: 'AI_REVIEW_NOT_CONFIGURED',
        message: 'AI 审核服务未配置',
      }),
    );
  }
  analyzeProjectChange(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException({
        code: 'AI_NOT_CONFIGURED',
        message: 'AI 项目变更影响分析未配置',
      }),
    );
  }
  status() {
    return { configured: false, provider: 'openai-compatible' };
  }
}

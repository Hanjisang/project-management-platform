import { ServiceUnavailableException } from '@nestjs/common';
import type { AiProvider } from './ai.provider';

export class NotConfiguredAiProvider implements AiProvider {
  analyze(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'AI 服务未配置' }),
    );
  }
  status() {
    return { configured: false, provider: 'openai-compatible' };
  }
}

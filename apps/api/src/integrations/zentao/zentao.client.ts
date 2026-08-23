import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ZentaoResponse {
  id?: string | number;
  data?: { id?: string | number };
  message?: string;
}

@Injectable()
export class ZentaoClient {
  constructor(private readonly config: ConfigService) {}
  configured(): boolean {
    return Boolean(this.config.get('ZENTAO_BASE_URL') && this.config.get('ZENTAO_TOKEN'));
  }
  async createTask(payload: Record<string, unknown>, idempotencyKey: string): Promise<string> {
    if (!this.configured())
      throw new ServiceUnavailableException({
        code: 'ZENTAO_NOT_CONFIGURED',
        message: '禅道集成未配置',
      });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(
        `${this.config.getOrThrow<string>('ZENTAO_BASE_URL').replace(/\/$/, '')}/api.php/v2/tasks`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            token: this.config.getOrThrow<string>('ZENTAO_TOKEN'),
            'idempotency-key': idempotencyKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      const body = (await response.json()) as ZentaoResponse;
      if (!response.ok)
        throw new BadGatewayException({
          code: 'ZENTAO_REQUEST_FAILED',
          message: body.message ?? `禅道请求失败 (${response.status})`,
        });
      const id = body.id ?? body.data?.id;
      if (id === undefined)
        throw new BadGatewayException({
          code: 'ZENTAO_RESPONSE_INVALID',
          message: '禅道返回缺少任务编号',
        });
      return String(id);
    } finally {
      clearTimeout(timeout);
    }
  }
}

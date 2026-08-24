import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class DingtalkService {
  status() {
    return {
      status: 'NOT_CONFIGURED',
      configured: false,
      capabilities: ['RESERVED_ADAPTER'],
      streamConfigured: false,
      fullChatMonitoring: false,
    };
  }

  receive(payload: unknown): Promise<{ id: string }> {
    void payload;
    return Promise.reject(
      new ConflictException({
        code: 'DINGTALK_NOT_ENABLED',
        message: '钉钉集成当前仅预留接口，尚未启用消息接收实现',
      }),
    );
  }
}

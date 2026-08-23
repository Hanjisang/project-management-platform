import { BadRequestException, Injectable } from '@nestjs/common';

interface DingtalkPayload {
  msgId?: string;
  senderNick?: string;
  senderStaffId?: string;
  text?: { content?: string };
  content?: string;
  projectCode?: string;
  createAt?: number;
}

@Injectable()
export class DingtalkMessageMapper {
  map(payload: DingtalkPayload) {
    const externalMessageId = payload.msgId?.trim();
    const content = (payload.text?.content ?? payload.content)?.trim();
    if (!externalMessageId || !content)
      throw new BadRequestException({
        code: 'DINGTALK_MESSAGE_INVALID',
        message: '钉钉消息缺少 msgId 或内容',
      });
    return {
      externalMessageId,
      senderName: payload.senderNick?.trim() || '钉钉用户',
      senderExternalId: payload.senderStaffId,
      content,
      projectCode: payload.projectCode?.trim(),
      receivedAt: payload.createAt ? new Date(payload.createAt) : new Date(),
      rawPayload: payload,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MessagesService } from '../../messages/messages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DingtalkMessageMapper } from './dingtalk-message.mapper';
import { DingtalkClient } from './dingtalk.client';

@Injectable()
export class DingtalkService {
  constructor(
    private readonly client: DingtalkClient,
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly mapper: DingtalkMessageMapper,
  ) {}
  status() {
    const configured = this.client.configured();
    return {
      status: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
      configured,
      capabilities: ['BOT_MENTION_CALLBACK', 'MANUAL_IMPORT'],
      streamConfigured: this.client.streamConfigured(),
      fullChatMonitoring: false,
    };
  }
  async receive(payload: unknown) {
    const mapped = this.mapper.map(payload as Parameters<DingtalkMessageMapper['map']>[0]);
    const project = mapped.projectCode
      ? await this.prisma.project.findFirst({
          where: { code: mapped.projectCode, deletedAt: null },
          select: { id: true },
        })
      : null;
    return this.messages.ingestExternal({
      source: 'DINGTALK_BOT',
      externalMessageId: mapped.externalMessageId,
      projectId: project?.id,
      senderName: mapped.senderName,
      senderExternalId: mapped.senderExternalId,
      content: mapped.content,
      receivedAt: mapped.receivedAt,
      rawPayload: mapped.rawPayload as Prisma.InputJsonValue,
    });
  }
}

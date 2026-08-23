import { Module } from '@nestjs/common';
import { MessagesModule } from '../../messages/messages.module';
import { DingtalkController } from './dingtalk.controller';
import { DingtalkMessageMapper } from './dingtalk-message.mapper';
import { DingtalkService } from './dingtalk.service';
import { DingtalkSignatureService } from './dingtalk-signature.service';
import { DingtalkClient } from './dingtalk.client';
@Module({
  imports: [MessagesModule],
  controllers: [DingtalkController],
  providers: [DingtalkService, DingtalkSignatureService, DingtalkMessageMapper, DingtalkClient],
})
export class DingtalkModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../integrations/ai/ai.module';
import { ProjectPlansModule } from '../project-plans/project-plans.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
@Module({
  imports: [AuthModule, AiModule, ProjectPlansModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import { AuditAction, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser } from '../common/types';
import { ConfirmMessageDto, CreateManualMessageDto, MessageListQueryDto } from './dto';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}
  @Get() @RequirePermissions(PERMISSIONS.MESSAGE_VIEW) list(
    @CurrentUser() user: RequestUser,
    @Query() query: MessageListQueryDto,
  ) {
    return this.service.list(user, query);
  }
  @Get('ai-status') @RequirePermissions(PERMISSIONS.MESSAGE_VIEW) status() {
    return this.service.status();
  }
  @Post('manual')
  @RequirePermissions(PERMISSIONS.MESSAGE_CREATE)
  @AuditAction('message.create', 'Message')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateManualMessageDto) {
    return this.service.createManual(user, dto);
  }
  @Post(':id/analyze')
  @RequirePermissions(PERMISSIONS.MESSAGE_ANALYZE)
  @AuditAction('message.analyze', 'Message')
  analyze(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.analyze(user, id);
  }
  @Post(':id/confirm')
  @RequirePermissions(PERMISSIONS.MESSAGE_CONFIRM)
  @AuditAction('message.confirm', 'Message')
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ConfirmMessageDto,
  ) {
    return this.service.confirm(user, id, dto);
  }
}

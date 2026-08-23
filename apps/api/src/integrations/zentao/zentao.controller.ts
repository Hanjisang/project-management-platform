import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import { AuditAction, CurrentUser, RequirePermissions } from '../../common/decorators';
import type { RequestUser } from '../../common/types';
import { ZentaoService } from './zentao.service';

@ApiTags('Zentao')
@Controller('integrations/zentao')
export class ZentaoController {
  constructor(private readonly service: ZentaoService) {}
  @Get('status') @RequirePermissions(PERMISSIONS.TASK_VIEW) status() {
    return this.service.status();
  }
  @Get('syncs') @RequirePermissions(PERMISSIONS.TASK_VIEW) list(@CurrentUser() user: RequestUser) {
    return this.service.list(user);
  }
  @Post('tasks/:id/sync')
  @RequirePermissions(PERMISSIONS.TASK_EDIT)
  @AuditAction('zentao.task.sync', 'ZentaoTaskSync')
  sync(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.syncTask(user, id);
  }
}

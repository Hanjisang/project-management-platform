import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  AuditAction,
  CurrentUser,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import {
  CancelWorkItemDto,
  CompleteWorkItemChecklistDto,
  CreateWorkItemDto,
  UpdateWorkItemDto,
  WorkItemListQueryDto,
} from './dto';
import { WorkItemsService } from './work-items.service';

@ApiTags('Work Items')
@Controller()
export class WorkItemsController {
  constructor(private readonly service: WorkItemsService) {}

  @Get('work-items')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  list(@CurrentUser() user: RequestUser, @Query() query: WorkItemListQueryDto) {
    return this.service.list(user, query);
  }

  @Get('work-items/:id')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.get(user, id);
  }

  @Get('projects/:projectId/execution')
  @RequirePermissions(PERMISSIONS.PLAN_VIEW)
  @RequireProjectAccess()
  execution(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string) {
    return this.service.execution(user, projectId);
  }

  @Post('projects/:projectId/work-items')
  @RequirePermissions(PERMISSIONS.TASK_CREATE)
  @RequireProjectAccess()
  @AuditAction('work-item.create', 'ProjectWorkItem')
  create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkItemDto,
  ) {
    return this.service.create(user, projectId, dto);
  }

  @Patch('work-items/:id')
  @RequirePermissions(PERMISSIONS.TASK_EDIT)
  @AuditAction('work-item.update', 'ProjectWorkItem')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkItemDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Post('work-items/:id/complete')
  @RequirePermissions(PERMISSIONS.TASK_COMPLETE)
  @AuditAction('work-item.complete', 'ProjectWorkItem')
  complete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.complete(user, id);
  }

  @Post('work-items/:id/cancel')
  @RequirePermissions(PERMISSIONS.TASK_EDIT)
  @AuditAction('work-item.cancel', 'ProjectWorkItem')
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CancelWorkItemDto,
  ) {
    return this.service.cancel(user, id, dto);
  }

  @Patch('work-item-checklist/:id')
  @RequirePermissions(PERMISSIONS.TASK_EDIT)
  @AuditAction('work-item.checklist.update', 'ProjectChecklistItem')
  checklist(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CompleteWorkItemChecklistDto,
  ) {
    return this.service.updateChecklist(user, id, dto.completed);
  }
}

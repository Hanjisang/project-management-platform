import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  AuditAction,
  CurrentUser,
  RequireAnyPermission,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import { ExecutionIntegrityService } from '../project-plans/execution-integrity.service';
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
  constructor(
    private readonly service: WorkItemsService,
    private readonly integrity: ExecutionIntegrityService,
  ) {}

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
  async create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkItemDto,
  ) {
    const required = dto.required ?? false;
    await this.integrity.assertDirectWorkItemCreationAllowed(user, projectId, required);
    const normalized = { ...dto, required };
    if (!normalized.planStageId && !normalized.parentWorkItemId) {
      const planStageId = await this.integrity.ensureManualStage(projectId);
      return this.service.create(user, projectId, { ...normalized, planStageId });
    }
    return this.service.create(user, projectId, normalized);
  }

  @Patch('work-items/:id')
  @RequireAnyPermission(PERMISSIONS.TASK_EDIT, PERMISSIONS.PLAN_EDIT)
  @AuditAction('work-item.update', 'ProjectWorkItem')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkItemDto,
  ) {
    const hasTaskEdit = user.isAdministrator || user.permissions.includes(PERMISSIONS.TASK_EDIT);
    if (!hasTaskEdit) {
      const planCompatibleFields = new Set<keyof UpdateWorkItemDto>([
        'ownerUserId',
        'plannedStartDate',
        'plannedEndDate',
      ]);
      const forbidden = (Object.keys(dto) as Array<keyof UpdateWorkItemDto>).filter(
        (key) => !planCompatibleFields.has(key),
      );
      if (forbidden.length)
        throw new ForbiddenException({
          code: 'PLAN_EDIT_SCOPE_EXCEEDED',
          message: '计划编辑权限仅允许调整任务负责人和计划起止日期',
          details: { forbiddenFields: forbidden },
        });
    }
    const planningFields: Array<keyof UpdateWorkItemDto> = [
      'name',
      'description',
      'ownerUserId',
      'priority',
      'plannedStartDate',
      'plannedEndDate',
    ];
    const planningChanged = planningFields.some((key) => dto[key] !== undefined);
    await this.integrity.assertDirectWorkItemUpdateAllowed(user, id, planningChanged);
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
  async cancel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CancelWorkItemDto,
  ) {
    await this.integrity.assertDirectWorkItemCancellationAllowed(user, id);
    return this.service.cancel(user, id, dto);
  }

  @Patch('work-item-checklist/:id')
  @RequireAnyPermission(PERMISSIONS.TASK_EDIT, PERMISSIONS.PLAN_EDIT)
  @AuditAction('work-item.checklist.update', 'ProjectChecklistItem')
  checklist(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CompleteWorkItemChecklistDto,
  ) {
    return this.service.updateChecklist(user, id, dto.completed);
  }
}

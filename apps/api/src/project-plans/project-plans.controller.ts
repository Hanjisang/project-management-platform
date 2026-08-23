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
import { CompleteChecklistDto, GeneratePlanDto, SyncPlanDto, UpdatePlanTaskDto } from './dto';
import { ProjectPlansService } from './project-plans.service';

@ApiTags('Project Plans')
@Controller()
export class ProjectPlansController {
  constructor(private readonly service: ProjectPlansService) {}
  @Get('projects/:projectId/plan')
  @RequirePermissions(PERMISSIONS.PLAN_VIEW)
  @RequireProjectAccess()
  get(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string) {
    return this.service.get(user, projectId);
  }
  @Post('projects/:projectId/plan')
  @RequirePermissions(PERMISSIONS.PLAN_EDIT)
  @RequireProjectAccess()
  @AuditAction('plan.generate', 'ProjectPlan')
  generate(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: GeneratePlanDto,
  ) {
    return this.service.generate(user, projectId, dto);
  }
  @Patch('plan-tasks/:id')
  @RequirePermissions(PERMISSIONS.PLAN_EDIT)
  @AuditAction('plan.task.update', 'ProjectPlanTask')
  updateTask(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlanTaskDto,
  ) {
    return this.service.updateTask(user, id, dto);
  }
  @Patch('checklist-items/:id')
  @RequirePermissions(PERMISSIONS.PLAN_EDIT)
  @AuditAction('plan.checklist.complete', 'ProjectChecklistItem')
  complete(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CompleteChecklistDto,
  ) {
    return this.service.completeChecklist(user, id, dto);
  }
  @Get('projects/:projectId/plan/sync-preview')
  @RequirePermissions(PERMISSIONS.PLAN_EDIT)
  @RequireProjectAccess()
  preview(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Query('sopVersionId') versionId: string,
  ) {
    return this.service.previewSync(user, projectId, versionId);
  }
  @Post('projects/:projectId/plan/sync')
  @RequirePermissions(PERMISSIONS.PLAN_EDIT)
  @RequireProjectAccess()
  @AuditAction('plan.sync', 'ProjectPlan')
  sync(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: SyncPlanDto,
  ) {
    return this.service.sync(user, projectId, dto);
  }
}

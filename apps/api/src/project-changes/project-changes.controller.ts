import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  AuditAction,
  CurrentUser,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import { ExecutionIntegrityService } from '../project-plans/execution-integrity.service';
import {
  ChangePreflightDto,
  CreateProjectChangeDto,
  DirectProjectAdjustmentDto,
  ProjectChangeDecisionDto,
} from './dto';
import { ProjectChangePostApplyService } from './project-change-post-apply.service';
import { ProjectChangesService } from './project-changes.service';

@ApiTags('Project Changes')
@Controller()
export class ProjectChangesController {
  constructor(
    private readonly service: ProjectChangesService,
    private readonly postApply: ProjectChangePostApplyService,
    private readonly integrity: ExecutionIntegrityService,
  ) {}
  @Get('projects/:projectId/change-requests')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_VIEW)
  @RequireProjectAccess()
  list(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string) {
    return this.service.list(user, projectId);
  }
  @Get('change-requests/:id')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_VIEW)
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.get(user, id);
  }
  @Post('projects/:projectId/change-impact/preflight')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_CREATE)
  @RequireProjectAccess()
  preflight(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: ChangePreflightDto,
  ) {
    return this.service.preflight(user, projectId, dto);
  }
  @Post('projects/:projectId/adjustments')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_CREATE)
  @RequireProjectAccess()
  @AuditAction('project.adjustment.apply', 'ProjectAdjustmentLog')
  adjust(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: DirectProjectAdjustmentDto,
  ) {
    return this.service.directAdjustment(user, projectId, dto);
  }
  @Post('projects/:projectId/change-requests')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_CREATE)
  @RequireProjectAccess()
  @AuditAction('project.change.create', 'ProjectChangeRequest')
  create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectChangeDto,
  ) {
    return this.service.create(user, projectId, dto);
  }
  @Post('change-requests/:id/submit')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_CREATE)
  @AuditAction('project.change.submit', 'ProjectChangeRequest')
  submit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.submit(user, id);
  }
  @Post('change-requests/:id/approve')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_APPROVE)
  @AuditAction('project.change.approve', 'ProjectChangeRequest')
  approve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ProjectChangeDecisionDto,
  ) {
    return this.service.approve(user, id, dto.comment);
  }
  @Post('change-requests/:id/reject')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_APPROVE)
  @AuditAction('project.change.reject', 'ProjectChangeRequest')
  reject(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ProjectChangeDecisionDto,
  ) {
    return this.service.reject(user, id, dto.comment);
  }
  @Post('change-requests/:id/apply')
  @RequirePermissions(PERMISSIONS.PROJECT_CHANGE_APPLY)
  @AuditAction('project.change.apply', 'ProjectChangeRequest')
  async apply(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const result = await this.service.apply(user, id);
    await this.postApply.process(result);
    await this.integrity.recomputeProject(result.projectId);
    return this.service.get(user, id);
  }
}

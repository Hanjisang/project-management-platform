import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import type { Response } from 'express';
import {
  AuditAction,
  CurrentUser,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import { ExecutionIntegrityService } from './execution-integrity.service';
import { GeneratePlanDto, SyncPlanDto } from './dto';
import { ProjectPlansService } from './project-plans.service';

@ApiTags('Project Plans')
@Controller()
export class ProjectPlansController {
  constructor(
    private readonly service: ProjectPlansService,
    private readonly integrity: ExecutionIntegrityService,
  ) {}
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
  @Get('project-deliverable-templates/:id/download')
  @RequirePermissions(PERMISSIONS.PLAN_VIEW)
  async downloadDeliverableTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.service.downloadDeliverableTemplate(user, id);
    response.setHeader('content-type', file.mimeType);
    response.setHeader(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    response.send(file.buffer);
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
  async sync(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: SyncPlanDto,
  ) {
    await this.integrity.assertSafeDirectSopSync(projectId);
    return this.service.sync(user, projectId, dto);
  }
}

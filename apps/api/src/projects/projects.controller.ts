import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
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
  CreateProjectDto,
  ProjectListQueryDto,
  SetProjectMembersDto,
  UpdateProjectDto,
} from './dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}
  @Get() @RequirePermissions(PERMISSIONS.PROJECT_VIEW) list(
    @CurrentUser() user: RequestUser,
    @Query() query: ProjectListQueryDto,
  ) {
    return this.service.list(user, query);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.PROJECT_CREATE)
  @AuditAction('project.create', 'Project')
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }
  @Get(':projectId') @RequirePermissions(PERMISSIONS.PROJECT_VIEW) @RequireProjectAccess() get(
    @CurrentUser() user: RequestUser,
    @Param('projectId') id: string,
  ) {
    return this.service.get(user, id);
  }
  @Patch(':projectId')
  @RequirePermissions(PERMISSIONS.PROJECT_EDIT)
  @RequireProjectAccess()
  @AuditAction('project.update', 'Project')
  update(
    @CurrentUser() user: RequestUser,
    @Param('projectId') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.service.update(user, id, dto);
  }
  @Delete(':projectId')
  @RequirePermissions(PERMISSIONS.PROJECT_DELETE)
  @RequireProjectAccess()
  @AuditAction('project.delete', 'Project')
  @HttpCode(204)
  async remove(@CurrentUser() user: RequestUser, @Param('projectId') id: string): Promise<void> {
    await this.service.remove(user, id);
  }
  @Post(':projectId/start')
  @RequirePermissions(PERMISSIONS.PROJECT_START)
  @RequireProjectAccess()
  @AuditAction('project.start', 'Project')
  start(@CurrentUser() user: RequestUser, @Param('projectId') id: string) {
    return this.service.start(user, id);
  }
  @Post(':projectId/pause')
  @RequirePermissions(PERMISSIONS.PROJECT_PAUSE)
  @RequireProjectAccess()
  @AuditAction('project.pause', 'Project')
  pause(@CurrentUser() user: RequestUser, @Param('projectId') id: string) {
    return this.service.pause(user, id);
  }
  @Post(':projectId/resume')
  @RequirePermissions(PERMISSIONS.PROJECT_PAUSE)
  @RequireProjectAccess()
  @AuditAction('project.resume', 'Project')
  resume(@CurrentUser() user: RequestUser, @Param('projectId') id: string) {
    return this.service.resume(user, id);
  }
  @Post(':projectId/close')
  @RequirePermissions(PERMISSIONS.PROJECT_CLOSE)
  @RequireProjectAccess()
  @AuditAction('project.close', 'Project')
  close(@CurrentUser() user: RequestUser, @Param('projectId') id: string) {
    return this.service.close(user, id);
  }
  @Get(':projectId/members')
  @RequirePermissions(PERMISSIONS.PROJECT_VIEW)
  @RequireProjectAccess()
  members(@CurrentUser() user: RequestUser, @Param('projectId') id: string) {
    return this.service.members(user, id);
  }
  @Put(':projectId/members')
  @RequirePermissions(PERMISSIONS.PROJECT_MEMBER_MANAGE)
  @RequireProjectAccess()
  @AuditAction('project.member.update', 'ProjectMember')
  setMembers(
    @CurrentUser() user: RequestUser,
    @Param('projectId') id: string,
    @Body() dto: SetProjectMembersDto,
  ) {
    return this.service.setMembers(user, id, dto);
  }
}

@ApiTags('Projects')
@Controller('project-user-options')
export class ProjectUserOptionsController {
  constructor(private readonly service: ProjectsService) {}
  @Get() @RequirePermissions(PERMISSIONS.PROJECT_CREATE) list() {
    return this.service.userOptions();
  }
}

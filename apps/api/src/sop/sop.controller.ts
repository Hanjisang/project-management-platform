import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import { AuditAction, RequirePermissions } from '../common/decorators';
import {
  CloneVersionDto,
  CreateChecklistItemDto,
  CreateSopStageDto,
  CreateSopTaskDto,
  CreateSopTemplateDto,
  CreateSopVersionDto,
  UpdateSopStageDto,
  UpdateSopTaskDto,
} from './dto';
import { SopService } from './sop.service';

@ApiTags('SOP')
@Controller('sop')
export class SopController {
  constructor(private readonly service: SopService) {}
  @Get('templates') @RequirePermissions(PERMISSIONS.SOP_VIEW) list() {
    return this.service.listTemplates();
  }
  @Get('templates/:id') @RequirePermissions(PERMISSIONS.SOP_VIEW) get(@Param('id') id: string) {
    return this.service.getTemplate(id);
  }
  @Post('templates')
  @RequirePermissions(PERMISSIONS.SOP_CREATE)
  @AuditAction('sop.template.create', 'SopTemplate')
  createTemplate(@Body() dto: CreateSopTemplateDto) {
    return this.service.createTemplate(dto);
  }
  @Post('templates/:templateId/versions')
  @RequirePermissions(PERMISSIONS.SOP_CREATE)
  @AuditAction('sop.version.create', 'SopVersion')
  createVersion(@Param('templateId') id: string, @Body() dto: CreateSopVersionDto) {
    return this.service.createVersion(id, dto);
  }
  @Get('versions/:id') @RequirePermissions(PERMISSIONS.SOP_VIEW) getVersion(
    @Param('id') id: string,
  ) {
    return this.service.getVersion(id);
  }
  @Post('versions/:versionId/stages')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.stage.create', 'SopStage')
  createStage(@Param('versionId') id: string, @Body() dto: CreateSopStageDto) {
    return this.service.createStage(id, dto);
  }
  @Patch('stages/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.stage.update', 'SopStage')
  updateStage(@Param('id') id: string, @Body() dto: UpdateSopStageDto) {
    return this.service.updateStage(id, dto);
  }
  @Delete('stages/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.stage.delete', 'SopStage')
  @HttpCode(204)
  removeStage(@Param('id') id: string) {
    return this.service.deleteStage(id);
  }
  @Post('stages/:stageId/tasks')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.task.create', 'SopTask')
  createTask(@Param('stageId') id: string, @Body() dto: CreateSopTaskDto) {
    return this.service.createTask(id, dto);
  }
  @Patch('tasks/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.task.update', 'SopTask')
  updateTask(@Param('id') id: string, @Body() dto: UpdateSopTaskDto) {
    return this.service.updateTask(id, dto);
  }
  @Delete('tasks/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.task.delete', 'SopTask')
  @HttpCode(204)
  removeTask(@Param('id') id: string) {
    return this.service.deleteTask(id);
  }
  @Post('tasks/:taskId/checklist-items')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.checklist.create', 'SopChecklistItem')
  createChecklist(@Param('taskId') id: string, @Body() dto: CreateChecklistItemDto) {
    return this.service.createChecklist(id, dto);
  }
  @Delete('checklist-items/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.checklist.delete', 'SopChecklistItem')
  @HttpCode(204)
  removeChecklist(@Param('id') id: string) {
    return this.service.deleteChecklist(id);
  }
  @Post('versions/:id/publish')
  @RequirePermissions(PERMISSIONS.SOP_PUBLISH)
  @AuditAction('sop.version.publish', 'SopVersion')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }
  @Post('versions/:id/clone')
  @RequirePermissions(PERMISSIONS.SOP_CREATE)
  @AuditAction('sop.version.clone', 'SopVersion')
  clone(@Param('id') id: string, @Body() dto: CloneVersionDto) {
    return this.service.clone(id, dto);
  }
}

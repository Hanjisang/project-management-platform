import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import type { Response } from 'express';
import { AuditAction, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser } from '../common/types';
import {
  CloneVersionDto,
  CreateChecklistItemDto,
  CreateSopDeliverableDto,
  CreateSopDeliverableCriterionDto,
  CreateSopStageDto,
  CreateSopTaskDto,
  CreateSopTemplateDto,
  CreateSopVersionDto,
  UpdateSopStageDto,
  UpdateSopDeliverableDto,
  UpdateSopDeliverableCriterionDto,
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
  @Post('tasks/:taskId/deliverables')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.deliverable.create', 'SopDeliverable')
  createDeliverable(@Param('taskId') taskId: string, @Body() dto: CreateSopDeliverableDto) {
    return this.service.createDeliverable(taskId, dto);
  }
  @Patch('deliverables/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.deliverable.update', 'SopDeliverable')
  updateDeliverable(@Param('id') id: string, @Body() dto: UpdateSopDeliverableDto) {
    return this.service.updateDeliverable(id, dto);
  }
  @Delete('deliverables/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.deliverable.delete', 'SopDeliverable')
  @HttpCode(204)
  removeDeliverable(@Param('id') id: string) {
    return this.service.deleteDeliverable(id);
  }
  @Post('deliverables/:id/review-criteria')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.deliverable.criterion.create', 'SopDeliverableReviewCriterion')
  createCriterion(@Param('id') id: string, @Body() dto: CreateSopDeliverableCriterionDto) {
    return this.service.createCriterion(id, dto);
  }
  @Patch('deliverable-review-criteria/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.deliverable.criterion.update', 'SopDeliverableReviewCriterion')
  updateCriterion(@Param('id') id: string, @Body() dto: UpdateSopDeliverableCriterionDto) {
    return this.service.updateCriterion(id, dto);
  }
  @Delete('deliverable-review-criteria/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.deliverable.criterion.delete', 'SopDeliverableReviewCriterion')
  @HttpCode(204)
  removeCriterion(@Param('id') id: string) {
    return this.service.deleteCriterion(id);
  }
  @Post('deliverables/:id/templates')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @AuditAction('sop.deliverable.template.upload', 'SopDeliverableTemplate')
  uploadDeliverableTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadDeliverableTemplate(user, id, file);
  }
  @Get('deliverable-templates/:id/download')
  @RequirePermissions(PERMISSIONS.SOP_VIEW)
  async downloadDeliverableTemplate(
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.service.downloadDeliverableTemplate(id);
    response.setHeader('content-type', file.mimeType);
    response.setHeader(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    response.send(file.buffer);
  }
  @Delete('deliverable-templates/:id')
  @RequirePermissions(PERMISSIONS.SOP_EDIT)
  @AuditAction('sop.deliverable.template.delete', 'SopDeliverableTemplate')
  @HttpCode(204)
  removeDeliverableTemplate(@Param('id') id: string) {
    return this.service.deleteDeliverableTemplate(id);
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
  clone(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CloneVersionDto) {
    return this.service.clone(user, id, dto);
  }
}

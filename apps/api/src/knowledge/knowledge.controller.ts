import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { KnowledgeStatus } from '@prisma/client';
import { PERMISSIONS } from '@pmp/shared-constants';
import { AuditAction, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser } from '../common/types';
import {
  CreateKnowledgeArticleDto,
  CreateKnowledgeCategoryDto,
  DepositDocumentDto,
  ReviewKnowledgeArticleDto,
  UpdateKnowledgeArticleDto,
} from './dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}
  @Get('categories') @RequirePermissions(PERMISSIONS.KNOWLEDGE_VIEW) categories() {
    return this.service.categories();
  }
  @Post('categories')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @AuditAction('knowledge.category.create', 'KnowledgeCategory')
  createCategory(@Body() dto: CreateKnowledgeCategoryDto) {
    return this.service.createCategory(dto);
  }
  @Get('articles') @RequirePermissions(PERMISSIONS.KNOWLEDGE_VIEW) list(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status', new ParseEnumPipe(KnowledgeStatus, { optional: true }))
    status?: KnowledgeStatus,
  ) {
    return this.service.list(user, search, categoryId, status);
  }
  @Get('articles/:id') @RequirePermissions(PERMISSIONS.KNOWLEDGE_VIEW) get(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.get(user, id);
  }
  @Post('articles')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @AuditAction('knowledge.article.create', 'KnowledgeArticle')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateKnowledgeArticleDto) {
    return this.service.create(user, dto);
  }
  @Patch('articles/:id')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @AuditAction('knowledge.article.update', 'KnowledgeArticle')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
  ) {
    return this.service.update(user, id, dto);
  }
  @Post('articles/:id/submit')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @AuditAction('knowledge.article.submit', 'KnowledgeArticle')
  submit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.submit(user, id);
  }
  @Post('articles/:id/review')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_REVIEW)
  @AuditAction('knowledge.article.review', 'KnowledgeArticle')
  review(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReviewKnowledgeArticleDto,
  ) {
    return this.service.review(user, id, dto);
  }
  @Post('articles/:id/attachments')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @AuditAction('knowledge.attachment.create', 'KnowledgeAttachment')
  uploadAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadAttachment(user, id, file);
  }
  @Get('attachments/:id/download')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_VIEW)
  async downloadAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.service.downloadAttachment(user, id);
    response.setHeader('content-type', file.mimeType);
    response.setHeader(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    response.send(file.buffer);
  }
  @Delete('attachments/:id')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @AuditAction('knowledge.attachment.delete', 'KnowledgeAttachment')
  removeAttachment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.removeAttachment(user, id);
  }
  @Post('documents/:documentId/deposit')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @AuditAction('knowledge.document.deposit', 'KnowledgeArticle')
  deposit(
    @CurrentUser() user: RequestUser,
    @Param('documentId') id: string,
    @Body() dto: DepositDocumentDto,
  ) {
    return this.service.deposit(user, id, dto);
  }
  @Delete('articles/:id')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_CREATE)
  @AuditAction('knowledge.article.delete', 'KnowledgeArticle')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}

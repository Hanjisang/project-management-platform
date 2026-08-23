import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  AuditAction,
  CurrentUser,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import { CreateDocumentDto, CreateDocumentVersionDto, ReviewDocumentDto } from './dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@Controller()
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}
  @Get('projects/:projectId/documents')
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  @RequireProjectAccess()
  list(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string) {
    return this.service.list(user, projectId);
  }
  @Post('projects/:projectId/documents')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  @RequireProjectAccess()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @AuditAction('document.create', 'Document')
  create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.create(user, projectId, dto, file);
  }
  @Post('documents/:id/versions')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @AuditAction('document.version.create', 'DocumentVersion')
  addVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateDocumentVersionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.addVersion(user, id, dto, file);
  }
  @Post('documents/:id/reviews')
  @RequirePermissions(PERMISSIONS.DOCUMENT_REVIEW)
  @AuditAction('document.review', 'DocumentReview')
  review(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.service.review(user, id, dto);
  }
  @Get('document-versions/:id/download')
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  async download(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.service.download(user, id);
    response.setHeader('content-type', file.mimeType);
    response.setHeader(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    response.send(file.buffer);
  }
  @Delete('documents/:id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  @AuditAction('document.delete', 'Document')
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}

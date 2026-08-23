import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDocumentDto, CreateDocumentVersionDto, ReviewDocumentDto } from './dto';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}
  async list(user: RequestUser, projectId: string) {
    await this.scope.assert(user, projectId);
    return this.prisma.document.findMany({
      where: { projectId, deletedAt: null },
      include: {
        planTask: { select: { id: true, name: true } },
        versions: { orderBy: { createdAt: 'desc' } },
        reviews: {
          include: { reviewer: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async create(
    user: RequestUser,
    projectId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File | undefined,
  ) {
    await this.scope.assert(user, projectId);
    this.validateFile(file);
    await this.validatePlanTask(projectId, dto.planTaskId);
    const stored = await this.storage.put(file.originalname, file.buffer);
    try {
      return await this.prisma.$transaction((tx) =>
        tx.document.create({
          data: {
            projectId,
            planTaskId: dto.planTaskId,
            name: dto.name.trim(),
            description: dto.description,
            required: dto.required ?? false,
            createdById: user.id,
            versions: {
              create: {
                version: this.version(dto.version),
                objectKey: stored.objectKey,
                fileName: file.originalname,
                mimeType: file.mimetype,
                size: stored.size,
                checksum: stored.checksum,
                uploadedById: user.id,
              },
            },
          },
          include: { versions: true },
        }),
      );
    } catch (error) {
      await this.compensateStoredObject(stored.objectKey, 'document-create-rollback', error);
      throw error;
    }
  }
  async addVersion(
    user: RequestUser,
    documentId: string,
    dto: CreateDocumentVersionDto,
    file: Express.Multer.File | undefined,
  ) {
    await this.getScoped(user, documentId);
    this.validateFile(file);
    const stored = await this.storage.put(file.originalname, file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const version = await tx.documentVersion.create({
          data: {
            documentId,
            version: this.version(dto.version),
            objectKey: stored.objectKey,
            fileName: file.originalname,
            mimeType: file.mimetype,
            size: stored.size,
            checksum: stored.checksum,
            uploadedById: user.id,
          },
        });
        await tx.document.update({ where: { id: documentId }, data: { status: 'DRAFT' } });
        return version;
      });
    } catch (error) {
      await this.compensateStoredObject(stored.objectKey, 'document-version-rollback', error);
      throw error;
    }
  }
  async review(user: RequestUser, documentId: string, dto: ReviewDocumentDto) {
    await this.getScoped(user, documentId);
    const documentStatus =
      dto.status === 'APPROVED'
        ? 'APPROVED'
        : dto.status === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING_REVIEW';
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.documentReview.upsert({
        where: { documentId_reviewerId: { documentId, reviewerId: user.id } },
        create: {
          documentId,
          reviewerId: user.id,
          status: dto.status,
          comment: dto.comment,
          reviewedAt: dto.status === 'PENDING' ? null : new Date(),
        },
        update: {
          status: dto.status,
          comment: dto.comment,
          reviewedAt: dto.status === 'PENDING' ? null : new Date(),
        },
      });
      await tx.document.update({ where: { id: documentId }, data: { status: documentStatus } });
      return review;
    });
  }
  async download(user: RequestUser, versionId: string) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: true },
    });
    if (!version || version.document.deletedAt)
      throw new NotFoundException({
        code: 'DOCUMENT_VERSION_NOT_FOUND',
        message: '文档版本不存在',
      });
    await this.scope.assert(user, version.document.projectId);
    return {
      buffer: await this.storage.get(version.objectKey),
      fileName: version.fileName,
      mimeType: version.mimeType,
    };
  }
  async remove(user: RequestUser, documentId: string): Promise<void> {
    const document = await this.getScoped(user, documentId);
    const versions = await this.prisma.$transaction(async (tx) => {
      const items = await tx.documentVersion.findMany({
        where: { documentId },
        select: { objectKey: true },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date(), status: 'ARCHIVED' },
      });
      return items;
    });
    for (const version of versions) {
      try {
        await this.storage.delete(version.objectKey);
      } catch (error) {
        await this.prisma.storageCleanupJob.upsert({
          where: { objectKey: version.objectKey },
          create: {
            objectKey: version.objectKey,
            reason: `document:${document.id}`,
            attempts: 1,
            lastError: error instanceof Error ? error.message : String(error),
          },
          update: {
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
  private async getScoped(user: RequestUser, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!document)
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: '文档不存在' });
    await this.scope.assert(user, document.projectId);
    return document;
  }
  private validateFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file)
      throw new BadRequestException({ code: 'DOCUMENT_FILE_REQUIRED', message: '请选择文件' });
    if (!ALLOWED_MIME_TYPES.has(file.mimetype))
      throw new BadRequestException({
        code: 'DOCUMENT_MIME_NOT_ALLOWED',
        message: '不支持该文件类型',
      });
    if (file.size <= 0 || file.size > 20 * 1024 * 1024)
      throw new BadRequestException({
        code: 'DOCUMENT_SIZE_INVALID',
        message: '文件大小必须在 20MB 以内',
      });
  }
  private async validatePlanTask(projectId: string, planTaskId?: string) {
    if (!planTaskId) return;
    const count = await this.prisma.projectPlanTask.count({
      where: { id: planTaskId, stage: { plan: { projectId } } },
    });
    if (!count)
      throw new BadRequestException({
        code: 'PLAN_TASK_INVALID',
        message: '交付物节点不属于该项目',
      });
  }
  private version(value: string): string {
    return value.toUpperCase().startsWith('V') ? value.toUpperCase() : `V${value}`;
  }
  private async compensateStoredObject(
    objectKey: string,
    reason: string,
    originalError: unknown,
  ): Promise<void> {
    try {
      await this.storage.delete(objectKey);
    } catch (cleanupError) {
      try {
        await this.prisma.storageCleanupJob.upsert({
          where: { objectKey },
          create: {
            objectKey,
            reason,
            attempts: 1,
            lastError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          },
          update: {
            attempts: { increment: 1 },
            lastError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          },
        });
      } catch (trackingError) {
        throw new AggregateError(
          [originalError, cleanupError, trackingError],
          '数据库写入及文件回滚追踪同时失败',
        );
      }
    }
  }
}

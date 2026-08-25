import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DeliverableReviewMode, Prisma } from '@prisma/client';
import { ProjectScopeService } from '../auth/project-scope.service';
import type { RequestUser } from '../common/types';
import { ProgressService } from '../project-plans/progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectWritable } from '../projects/project-mutation';
import type { CreateDocumentDto, CreateDocumentVersionDto, ReviewDocumentDto } from './dto';
import { DOCUMENT_MIME_TYPES, safeOriginalFileName, validateUploadedFile } from './file-validation';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';

type Association = {
  workItemId?: string;
  projectDeliverableId?: string;
  required?: boolean;
  reviewMode?: DeliverableReviewMode;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly progress: ProgressService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async list(user: RequestUser, projectId: string) {
    await this.scope.assert(user, projectId);
    return this.prisma.document.findMany({
      where: { projectId, deletedAt: null },
      include: {
        workItem: { select: { id: true, name: true, stage: { select: { id: true, name: true } } } },
        projectDeliverable: {
          include: {
            workItem: { include: { stage: { select: { id: true, name: true } } } },
            reviewCriteria: { orderBy: { sortOrder: 'asc' } },
          },
        },
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: { select: { id: true, displayName: true } },
            reviews: {
              orderBy: { createdAt: 'desc' },
              include: {
                reviewer: { select: { id: true, displayName: true } },
                findings: { orderBy: { sortOrder: 'asc' } },
                criterionResults: true,
              },
            },
          },
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
    const association = await this.validateAssociation(
      projectId,
      dto.workItemId,
      dto.projectDeliverableId,
    );
    const fileName = safeOriginalFileName(file.originalname);
    const stored = await this.storage.put(fileName, file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertProjectWritable(tx, projectId);
        const document = await tx.document.create({
          data: {
            projectId,
            workItemId: association.workItemId,
            projectDeliverableId: association.projectDeliverableId,
            name: dto.name.trim(),
            description: dto.description,
            required: association.required ?? dto.required ?? false,
            status: association.projectDeliverableId ? 'PENDING_REVIEW' : 'DRAFT',
            createdById: user.id,
            versions: {
              create: {
                version: this.version(dto.version),
                objectKey: stored.objectKey,
                fileName,
                mimeType: file.mimetype,
                size: stored.size,
                checksum: stored.checksum,
                uploadedById: user.id,
              },
            },
          },
          include: { versions: true },
        });
        const latest = document.versions[0];
        if (association.projectDeliverableId && latest)
          await this.initializeReview(tx, latest.id, association.reviewMode ?? 'HUMAN_ONLY');
        if (association.workItemId)
          await this.progress.recomputeWorkItem(association.workItemId, tx);
        return document;
      });
    } catch (error) {
      await this.compensateStoredObject(stored.objectKey, 'document-create-rollback', error);
      throw error;
    }
  }

  async createForDeliverable(
    user: RequestUser,
    projectDeliverableId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File | undefined,
  ) {
    const deliverable = await this.prisma.projectDeliverable.findUnique({
      where: { id: projectDeliverableId },
      include: { workItem: true },
    });
    if (!deliverable)
      throw new NotFoundException({
        code: 'PROJECT_DELIVERABLE_NOT_FOUND',
        message: '项目交付物不存在',
      });
    await this.scope.assert(user, deliverable.workItem.projectId);
    const existing = await this.prisma.document.findUnique({ where: { projectDeliverableId } });
    if (existing && !existing.deletedAt)
      throw new ConflictException({
        code: 'PROJECT_DELIVERABLE_DOCUMENT_EXISTS',
        message: '该项目交付物已有逻辑文档，请上传新版本',
      });
    return this.create(
      user,
      deliverable.workItem.projectId,
      { ...dto, workItemId: deliverable.workItemId, projectDeliverableId },
      file,
    );
  }

  async addVersion(
    user: RequestUser,
    documentId: string,
    dto: CreateDocumentVersionDto,
    file: Express.Multer.File | undefined,
  ) {
    const document = await this.getScoped(user, documentId);
    this.validateFile(file);
    const fileName = safeOriginalFileName(file.originalname);
    const stored = await this.storage.put(fileName, file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertProjectWritable(tx, document.projectId);
        const version = await tx.documentVersion.create({
          data: {
            documentId,
            version: this.version(dto.version),
            objectKey: stored.objectKey,
            fileName,
            mimeType: file.mimetype,
            size: stored.size,
            checksum: stored.checksum,
            uploadedById: user.id,
          },
        });
        await tx.document.update({
          where: { id: documentId },
          data: { status: document.projectDeliverableId ? 'PENDING_REVIEW' : 'DRAFT' },
        });
        if (document.projectDeliverableId) {
          const deliverable = await tx.projectDeliverable.update({
            where: { id: document.projectDeliverableId },
            data: { needsRevision: false, revisionReason: null },
            select: { reviewMode: true },
          });
          await this.initializeReview(tx, version.id, deliverable.reviewMode);
        }
        if (document.workItemId) await this.progress.recomputeWorkItem(document.workItemId, tx);
        return version;
      });
    } catch (error) {
      await this.compensateStoredObject(stored.objectKey, 'document-version-rollback', error);
      throw error;
    }
  }

  async review(user: RequestUser, documentId: string, dto: ReviewDocumentDto) {
    const document = await this.getScoped(user, documentId);
    if (document.status === 'DRAFT')
      throw new ConflictException({
        code: 'DOCUMENT_REVIEW_STATE_INVALID',
        message: '草稿必须先提交后才能审核',
      });
    const latest = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest)
      throw new ConflictException({
        code: 'DOCUMENT_VERSION_REQUIRED',
        message: '文档没有可审核版本',
      });
    if (!user.isAdministrator && latest.uploadedById === user.id)
      throw new ConflictException({
        code: 'DOCUMENT_SELF_REVIEW_FORBIDDEN',
        message: '上传人不能审核自己的交付物',
      });
    if (!['APPROVED', 'REJECTED'].includes(dto.status))
      throw new BadRequestException({
        code: 'DOCUMENT_REVIEW_DECISION_REQUIRED',
        message: '人工审核结果必须为通过或驳回',
      });
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, document.projectId);
      const review = await tx.documentVersionReview.create({
        data: {
          documentVersionId: latest.id,
          reviewType: 'HUMAN',
          status: dto.status,
          reviewerUserId: user.id,
          summary: dto.comment,
          decisionReason: dto.comment,
          reviewedAt: new Date(),
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { status: dto.status === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
      });
      if (document.workItemId) await this.progress.recomputeWorkItem(document.workItemId, tx);
      return review;
    });
  }

  async submit(user: RequestUser, documentId: string) {
    const document = await this.getScoped(user, documentId);
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, document.projectId);
      const updated = await tx.document.update({
        where: { id: documentId },
        data: { status: 'PENDING_REVIEW' },
      });
      if (document.projectDeliverableId) {
        const latest = await tx.documentVersion.findFirst({
          where: { documentId },
          orderBy: { createdAt: 'desc' },
        });
        if (!latest) return updated;
        const deliverable = await tx.projectDeliverable.findUnique({
          where: { id: document.projectDeliverableId },
          select: { reviewMode: true },
        });
        if (deliverable) await this.initializeReview(tx, latest.id, deliverable.reviewMode);
      }
      if (document.workItemId) await this.progress.recomputeWorkItem(document.workItemId, tx);
      return updated;
    });
  }

  async retryAiReview(user: RequestUser, versionId: string) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { projectDeliverable: true } } },
    });
    if (!version || version.document.deletedAt)
      throw new NotFoundException({
        code: 'DOCUMENT_VERSION_NOT_FOUND',
        message: '文档版本不存在',
      });
    await this.scope.assert(user, version.document.projectId);
    if (
      !version.document.projectDeliverable ||
      version.document.projectDeliverable.reviewMode === 'HUMAN_ONLY'
    )
      throw new ConflictException({
        code: 'AI_REVIEW_UNSUPPORTED_FILE',
        message: '该交付物未启用 AI 审核',
      });
    const existingJob = await this.prisma.aiReviewJob.findUnique({
      where: { documentVersionId: versionId },
    });
    if (!existingJob || existingJob.status !== 'FAILED')
      throw new ConflictException({
        code: 'AI_REVIEW_RETRY_NOT_ALLOWED',
        message: '只有失败的 AI 审核任务可以重试',
      });
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, version.document.projectId);
      await tx.documentVersionReview.deleteMany({
        where: { documentVersionId: versionId, reviewType: 'AI', status: 'PENDING' },
      });
      await tx.documentVersionReview.create({
        data: { documentVersionId: versionId, reviewType: 'AI', status: 'PENDING' },
      });
      return tx.aiReviewJob.upsert({
        where: { documentVersionId: versionId },
        create: { documentVersionId: versionId },
        update: {
          status: 'PENDING',
          nextRunAt: new Date(),
          lastError: null,
          claimedAt: null,
          completedAt: null,
        },
      });
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
      await assertProjectWritable(tx, document.projectId);
      const items = await tx.documentVersion.findMany({
        where: { documentId },
        select: { objectKey: true },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date(), status: 'ARCHIVED' },
      });
      if (document.workItemId) await this.progress.recomputeWorkItem(document.workItemId, tx);
      return items;
    });
    for (const version of versions) {
      try {
        await this.storage.delete(version.objectKey);
      } catch (error) {
        await this.trackCleanup(version.objectKey, `document:${document.id}`, error);
      }
    }
  }

  private async initializeReview(
    tx: Prisma.TransactionClient,
    documentVersionId: string,
    reviewMode: DeliverableReviewMode,
  ) {
    if (reviewMode === 'HUMAN_ONLY') return;
    const pending = await tx.documentVersionReview.findFirst({
      where: { documentVersionId, reviewType: 'AI', status: 'PENDING' },
    });
    if (!pending)
      await tx.documentVersionReview.create({
        data: { documentVersionId, reviewType: 'AI', status: 'PENDING' },
      });
    const job = await tx.aiReviewJob.findUnique({ where: { documentVersionId } });
    if (!job) await tx.aiReviewJob.create({ data: { documentVersionId } });
  }
  private async getScoped(user: RequestUser, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!document)
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: '文档不存在' });
    await this.scope.assert(user, document.projectId);
    return document;
  }
  private validateFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    validateUploadedFile(file, {
      allowedMimeTypes: DOCUMENT_MIME_TYPES,
      maxBytes: 50 * 1024 * 1024,
      errorPrefix: 'DOCUMENT',
      label: '文件',
    });
  }
  private async validateAssociation(
    projectId: string,
    workItemId?: string,
    projectDeliverableId?: string,
  ): Promise<Association> {
    if (!projectDeliverableId) {
      if (
        workItemId &&
        !(await this.prisma.projectWorkItem.count({ where: { id: workItemId, projectId } }))
      )
        throw new BadRequestException({ code: 'WORK_ITEM_INVALID', message: '任务不属于该项目' });
      return { workItemId };
    }
    const deliverable = await this.prisma.projectDeliverable.findFirst({
      where: { id: projectDeliverableId, workItem: { projectId } },
      select: { workItemId: true, required: true, reviewMode: true },
    });
    if (!deliverable || (workItemId && workItemId !== deliverable.workItemId))
      throw new BadRequestException({
        code: 'PROJECT_DELIVERABLE_INVALID',
        message: '项目交付物不属于该项目或任务',
      });
    return {
      workItemId: deliverable.workItemId,
      projectDeliverableId,
      required: deliverable.required,
      reviewMode: deliverable.reviewMode,
    };
  }
  private version(value: string) {
    return value.toUpperCase().startsWith('V') ? value.toUpperCase() : `V${value}`;
  }
  private async trackCleanup(objectKey: string, reason: string, error: unknown) {
    await this.prisma.storageCleanupJob.upsert({
      where: { objectKey },
      create: {
        objectKey,
        reason,
        attempts: 1,
        lastError: error instanceof Error ? error.message : String(error),
      },
      update: {
        attempts: { increment: 1 },
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }
  private async compensateStoredObject(objectKey: string, reason: string, originalError: unknown) {
    try {
      await this.storage.delete(objectKey);
    } catch (cleanupError) {
      try {
        await this.trackCleanup(objectKey, reason, cleanupError);
      } catch (trackingError) {
        throw new AggregateError(
          [originalError, cleanupError, trackingError],
          '数据库写入及文件回滚追踪同时失败',
        );
      }
    }
  }
}

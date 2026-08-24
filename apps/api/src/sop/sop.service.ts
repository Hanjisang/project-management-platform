import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeWeights } from '@pmp/shared-utils';
import type { RequestUser } from '../common/types';
import {
  safeOriginalFileName,
  SOP_TEMPLATE_MIME_TYPES,
  validateUploadedFile,
} from '../documents/file-validation';
import { STORAGE_PROVIDER, type StorageProvider } from '../documents/storage.provider';
import { PrismaService } from '../prisma/prisma.service';
import type {
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

@Injectable()
export class SopService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}
  listTemplates() {
    return this.prisma.sopTemplate.findMany({
      where: { deletedAt: null },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, version: true, status: true, publishedAt: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async getTemplate(id: string) {
    const item = await this.prisma.sopTemplate.findFirst({
      where: { id, deletedAt: null },
      include: {
        versions: {
          include: {
            stages: {
              include: {
                tasks: {
                  include: {
                    checklistItems: { orderBy: { sortOrder: 'asc' } },
                    deliverables: {
                      include: {
                        templates: { orderBy: { createdAt: 'asc' } },
                        reviewCriteria: { orderBy: { sortOrder: 'asc' } },
                      },
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!item) throw this.notFound('SOP_TEMPLATE_NOT_FOUND', '模板不存在');
    return item;
  }
  createTemplate(dto: CreateSopTemplateDto) {
    return this.prisma.sopTemplate.create({
      data: { code: dto.code.toUpperCase(), name: dto.name.trim(), description: dto.description },
    });
  }
  async createVersion(templateId: string, dto: CreateSopVersionDto) {
    await this.assertTemplate(templateId);
    return this.prisma.sopVersion.create({
      data: {
        templateId,
        version: dto.version.toUpperCase().startsWith('V')
          ? dto.version.toUpperCase()
          : `V${dto.version}`,
        description: dto.description,
      },
    });
  }
  async getVersion(id: string) {
    const version = await this.prisma.sopVersion.findUnique({
      where: { id },
      include: {
        template: true,
        stages: {
          include: {
            tasks: {
              include: {
                checklistItems: { orderBy: { sortOrder: 'asc' } },
                deliverables: {
                  include: {
                    templates: { orderBy: { createdAt: 'asc' } },
                    reviewCriteria: { orderBy: { sortOrder: 'asc' } },
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!version) throw this.notFound('SOP_VERSION_NOT_FOUND', 'SOP 版本不存在');
    return version;
  }
  async createStage(versionId: string, dto: CreateSopStageDto) {
    await this.assertDraftVersion(versionId);
    const sortOrder = dto.sortOrder ?? (await this.nextStageOrder(versionId));
    return this.prisma.sopStage.create({
      data: {
        sopVersionId: versionId,
        name: dto.name.trim(),
        description: dto.description,
        sortOrder,
        defaultDurationDays: dto.defaultDurationDays,
      },
    });
  }
  async updateStage(id: string, dto: UpdateSopStageDto) {
    const stage = await this.prisma.sopStage.findUnique({
      where: { id },
      select: { sopVersionId: true },
    });
    if (!stage) throw this.notFound('SOP_STAGE_NOT_FOUND', '阶段不存在');
    await this.assertDraftVersion(stage.sopVersionId);
    return this.prisma.sopStage.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
  }
  async deleteStage(id: string) {
    const stage = await this.prisma.sopStage.findUnique({
      where: { id },
      select: {
        sopVersionId: true,
        tasks: {
          select: {
            deliverables: { select: { templates: { select: { objectKey: true } } } },
          },
        },
      },
    });
    if (!stage) throw this.notFound('SOP_STAGE_NOT_FOUND', '阶段不存在');
    await this.assertDraftVersion(stage.sopVersionId);
    await this.prisma.sopStage.delete({ where: { id } });
    await this.removeStoredObjects(
      stage.tasks.flatMap((task) =>
        task.deliverables.flatMap((deliverable) =>
          deliverable.templates.map((item) => item.objectKey),
        ),
      ),
      `sop-stage:${id}`,
    );
  }
  async createTask(stageId: string, dto: CreateSopTaskDto) {
    const stage = await this.prisma.sopStage.findUnique({
      where: { id: stageId },
      select: { sopVersionId: true },
    });
    if (!stage) throw this.notFound('SOP_STAGE_NOT_FOUND', '阶段不存在');
    await this.assertDraftVersion(stage.sopVersionId);
    const sortOrder = dto.sortOrder ?? (await this.nextTaskOrder(stageId));
    return this.prisma.sopTask.create({
      data: {
        stageId,
        name: dto.name.trim(),
        description: dto.description,
        sortOrder,
        defaultDurationDays: dto.defaultDurationDays,
        required: dto.required ?? true,
      },
    });
  }
  async updateTask(id: string, dto: UpdateSopTaskDto) {
    const task = await this.prisma.sopTask.findUnique({
      where: { id },
      include: { stage: { select: { sopVersionId: true } } },
    });
    if (!task) throw this.notFound('SOP_TASK_NOT_FOUND', 'SOP 任务不存在');
    await this.assertDraftVersion(task.stage.sopVersionId);
    return this.prisma.sopTask.update({
      where: { id },
      data: { ...dto, name: dto.name.trim() },
    });
  }
  async deleteTask(id: string) {
    const task = await this.prisma.sopTask.findUnique({
      where: { id },
      include: {
        stage: { select: { sopVersionId: true } },
        deliverables: { select: { templates: { select: { objectKey: true } } } },
      },
    });
    if (!task) throw this.notFound('SOP_TASK_NOT_FOUND', 'SOP 任务不存在');
    await this.assertDraftVersion(task.stage.sopVersionId);
    await this.prisma.sopTask.delete({ where: { id } });
    await this.removeStoredObjects(
      task.deliverables.flatMap((deliverable) =>
        deliverable.templates.map((item) => item.objectKey),
      ),
      `sop-task:${id}`,
    );
  }
  async createChecklist(taskId: string, dto: CreateChecklistItemDto) {
    const task = await this.prisma.sopTask.findUnique({
      where: { id: taskId },
      include: { stage: { select: { sopVersionId: true } } },
    });
    if (!task) throw this.notFound('SOP_TASK_NOT_FOUND', 'SOP 任务不存在');
    await this.assertDraftVersion(task.stage.sopVersionId);
    const sortOrder = dto.sortOrder ?? (await this.nextChecklistOrder(taskId));
    return this.prisma.sopChecklistItem.create({
      data: { taskId, name: dto.name.trim(), sortOrder, required: dto.required ?? true },
    });
  }
  async deleteChecklist(id: string) {
    const item = await this.prisma.sopChecklistItem.findUnique({
      where: { id },
      include: { task: { include: { stage: { select: { sopVersionId: true } } } } },
    });
    if (!item) throw this.notFound('SOP_CHECKLIST_NOT_FOUND', '检查项不存在');
    await this.assertDraftVersion(item.task.stage.sopVersionId);
    await this.prisma.sopChecklistItem.delete({ where: { id } });
  }
  async createDeliverable(taskId: string, dto: CreateSopDeliverableDto) {
    const task = await this.prisma.sopTask.findUnique({
      where: { id: taskId },
      include: { stage: { select: { sopVersionId: true } } },
    });
    if (!task) throw this.notFound('SOP_TASK_NOT_FOUND', 'SOP 任务不存在');
    await this.assertDraftVersion(task.stage.sopVersionId);
    const sortOrder = dto.sortOrder ?? (await this.nextDeliverableOrder(taskId));
    return this.prisma.sopDeliverable.create({
      data: {
        sopTaskId: taskId,
        name: dto.name.trim(),
        description: dto.description,
        required: dto.required ?? true,
        sortOrder,
        reviewMode: dto.reviewMode ?? 'HUMAN_ONLY',
        aiReviewEnabled: dto.aiReviewEnabled ?? dto.reviewMode !== 'HUMAN_ONLY',
        aiAutoApproveThreshold: dto.aiAutoApproveThreshold,
        aiReviewInstruction: dto.aiReviewInstruction,
      },
      include: { templates: true, reviewCriteria: true },
    });
  }
  async updateDeliverable(id: string, dto: UpdateSopDeliverableDto) {
    const deliverable = await this.deliverableWithVersion(id);
    await this.assertDraftVersion(deliverable.task.stage.sopVersionId);
    return this.prisma.sopDeliverable.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
      include: {
        templates: { orderBy: { createdAt: 'asc' } },
        reviewCriteria: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }
  async createCriterion(deliverableId: string, dto: CreateSopDeliverableCriterionDto) {
    const deliverable = await this.deliverableWithVersion(deliverableId);
    await this.assertDraftVersion(deliverable.task.stage.sopVersionId);
    const aggregate = await this.prisma.sopDeliverableReviewCriterion.aggregate({
      where: { deliverableId },
      _max: { sortOrder: true },
    });
    return this.prisma.sopDeliverableReviewCriterion.create({
      data: {
        deliverableId,
        name: dto.name.trim(),
        description: dto.description,
        required: dto.required ?? true,
        weight: dto.weight ?? 0,
        sortOrder: dto.sortOrder ?? (aggregate._max.sortOrder ?? -1) + 1,
      },
    });
  }
  async updateCriterion(id: string, dto: UpdateSopDeliverableCriterionDto) {
    const criterion = await this.prisma.sopDeliverableReviewCriterion.findUnique({
      where: { id },
      include: { deliverable: { include: { task: { include: { stage: true } } } } },
    });
    if (!criterion) throw this.notFound('SOP_REVIEW_CRITERION_NOT_FOUND', '审核标准不存在');
    await this.assertDraftVersion(criterion.deliverable.task.stage.sopVersionId);
    return this.prisma.sopDeliverableReviewCriterion.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
    });
  }
  async deleteCriterion(id: string) {
    const criterion = await this.prisma.sopDeliverableReviewCriterion.findUnique({
      where: { id },
      include: { deliverable: { include: { task: { include: { stage: true } } } } },
    });
    if (!criterion) throw this.notFound('SOP_REVIEW_CRITERION_NOT_FOUND', '审核标准不存在');
    await this.assertDraftVersion(criterion.deliverable.task.stage.sopVersionId);
    await this.prisma.sopDeliverableReviewCriterion.delete({ where: { id } });
  }
  async deleteDeliverable(id: string): Promise<void> {
    const deliverable = await this.deliverableWithVersion(id);
    await this.assertDraftVersion(deliverable.task.stage.sopVersionId);
    await this.prisma.sopDeliverable.delete({ where: { id } });
    await this.removeStoredObjects(
      deliverable.templates.map((item) => item.objectKey),
      `sop-deliverable:${id}`,
    );
  }
  async uploadDeliverableTemplate(
    user: RequestUser,
    deliverableId: string,
    file: Express.Multer.File | undefined,
  ) {
    const deliverable = await this.deliverableWithVersion(deliverableId);
    await this.assertDraftVersion(deliverable.task.stage.sopVersionId);
    validateUploadedFile(file, {
      allowedMimeTypes: SOP_TEMPLATE_MIME_TYPES,
      maxBytes: 50 * 1024 * 1024,
      errorPrefix: 'SOP_TEMPLATE',
      label: '模板文件',
    });
    const fileName = safeOriginalFileName(file.originalname);
    const duplicate = await this.prisma.sopDeliverableTemplate.count({
      where: { deliverableId, fileName },
    });
    if (duplicate)
      throw new ConflictException({
        code: 'SOP_TEMPLATE_FILE_EXISTS',
        message: '同名模板已存在，请先删除旧模板',
      });
    const stored = await this.storage.put(fileName, file.buffer);
    try {
      return await this.prisma.sopDeliverableTemplate.create({
        data: {
          deliverableId,
          fileName,
          objectKey: stored.objectKey,
          mimeType: file.mimetype,
          size: stored.size,
          checksum: stored.checksum,
          uploadedById: user.id,
        },
      });
    } catch (error) {
      await this.compensateStoredObject(
        stored.objectKey,
        `sop-template-create-rollback:${deliverableId}`,
        error,
      );
      throw error;
    }
  }
  async downloadDeliverableTemplate(id: string) {
    const template = await this.prisma.sopDeliverableTemplate.findUnique({ where: { id } });
    if (!template) throw this.notFound('SOP_DELIVERABLE_TEMPLATE_NOT_FOUND', '交付物模板不存在');
    return {
      buffer: await this.storage.get(template.objectKey),
      fileName: template.fileName,
      mimeType: template.mimeType,
    };
  }
  async deleteDeliverableTemplate(id: string): Promise<void> {
    const template = await this.templateWithVersion(id);
    await this.assertDraftVersion(template.deliverable.task.stage.sopVersionId);
    await this.prisma.sopDeliverableTemplate.delete({ where: { id } });
    await this.removeStoredObjects([template.objectKey], `sop-deliverable-template:${id}`);
  }
  async publish(versionId: string) {
    const version = await this.getVersion(versionId);
    if (version.status !== 'DRAFT')
      throw new ConflictException({ code: 'SOP_VERSION_IMMUTABLE', message: '只有草稿版本可发布' });
    if (version.stages.length === 0 || version.stages.some((stage) => stage.tasks.length === 0))
      throw new BadRequestException({
        code: 'SOP_STRUCTURE_INCOMPLETE',
        message: 'SOP 至少需要一个阶段，且每个阶段至少有一个任务',
      });
    const normalizedStages = normalizeWeights(
      version.stages.map((stage) => ({ id: stage.id, durationDays: stage.defaultDurationDays })),
    );
    await this.prisma.$transaction(async (tx) => {
      for (const stage of version.stages) {
        const weight = normalizedStages.find((item) => item.id === stage.id)!.weight;
        await tx.sopStage.update({ where: { id: stage.id }, data: { weight } });
        const tasks = normalizeWeights(
          stage.tasks.map((task) => ({ id: task.id, durationDays: task.defaultDurationDays })),
        );
        for (const task of tasks)
          await tx.sopTask.update({ where: { id: task.id }, data: { weight: task.weight } });
      }
      await tx.sopVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
    });
    return this.getVersion(versionId);
  }
  async clone(user: RequestUser, versionId: string, dto: CloneVersionDto) {
    const source = await this.getVersion(versionId);
    const normalizedVersion = dto.version.toUpperCase().startsWith('V')
      ? dto.version.toUpperCase()
      : `V${dto.version}`;
    const copiedObjects: string[] = [];
    const copies = new Map<string, { objectKey: string; size: bigint; checksum: string }>();
    try {
      for (const template of source.stages.flatMap((stage) =>
        stage.tasks.flatMap((task) =>
          task.deliverables.flatMap((deliverable) => deliverable.templates),
        ),
      )) {
        const stored = await this.storage.put(
          template.fileName,
          await this.storage.get(template.objectKey),
        );
        copiedObjects.push(stored.objectKey);
        copies.set(template.id, stored);
      }
      const created = await this.prisma.$transaction((tx) =>
        tx.sopVersion.create({
          data: {
            templateId: source.templateId,
            version: normalizedVersion,
            description: dto.description ?? source.description,
            stages: {
              create: source.stages.map((stage) => ({
                stableKey: stage.stableKey,
                name: stage.name,
                description: stage.description,
                sortOrder: stage.sortOrder,
                defaultDurationDays: stage.defaultDurationDays,
                weight: stage.weight,
                tasks: {
                  create: stage.tasks.map((task) => ({
                    stableKey: task.stableKey,
                    name: task.name,
                    description: task.description,
                    sortOrder: task.sortOrder,
                    defaultDurationDays: task.defaultDurationDays,
                    weight: task.weight,
                    required: task.required,
                    checklistItems: {
                      create: task.checklistItems.map((item) => ({
                        stableKey: item.stableKey,
                        name: item.name,
                        sortOrder: item.sortOrder,
                        required: item.required,
                      })),
                    },
                    deliverables: {
                      create: task.deliverables.map((deliverable) => ({
                        stableKey: deliverable.stableKey,
                        name: deliverable.name,
                        description: deliverable.description,
                        required: deliverable.required,
                        sortOrder: deliverable.sortOrder,
                        reviewMode: deliverable.reviewMode,
                        aiReviewEnabled: deliverable.aiReviewEnabled,
                        aiAutoApproveThreshold: deliverable.aiAutoApproveThreshold,
                        aiReviewInstruction: deliverable.aiReviewInstruction,
                        templates: {
                          create: deliverable.templates.map((template) => {
                            const stored = copies.get(template.id)!;
                            return {
                              fileName: template.fileName,
                              objectKey: stored.objectKey,
                              mimeType: template.mimeType,
                              size: stored.size,
                              checksum: stored.checksum,
                              uploadedById: user.id,
                            };
                          }),
                        },
                        reviewCriteria: {
                          create: deliverable.reviewCriteria.map((criterion) => ({
                            stableKey: criterion.stableKey,
                            name: criterion.name,
                            description: criterion.description,
                            required: criterion.required,
                            weight: criterion.weight,
                            sortOrder: criterion.sortOrder,
                          })),
                        },
                      })),
                    },
                  })),
                },
              })),
            },
          },
        }),
      );
      return this.getVersion(created.id);
    } catch (error) {
      await this.removeStoredObjects(copiedObjects, `sop-version-clone:${versionId}`);
      throw error;
    }
  }
  private async assertTemplate(id: string) {
    const count = await this.prisma.sopTemplate.count({ where: { id, deletedAt: null } });
    if (!count) throw this.notFound('SOP_TEMPLATE_NOT_FOUND', '模板不存在');
  }
  private async assertDraftVersion(id: string) {
    const version = await this.prisma.sopVersion.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!version) throw this.notFound('SOP_VERSION_NOT_FOUND', 'SOP 版本不存在');
    if (version.status !== 'DRAFT')
      throw new ConflictException({
        code: 'SOP_VERSION_IMMUTABLE',
        message: '已发布版本不可直接修改，请创建新版本',
      });
  }
  private async nextStageOrder(versionId: string) {
    const value = await this.prisma.sopStage.aggregate({
      where: { sopVersionId: versionId },
      _max: { sortOrder: true },
    });
    return (value._max.sortOrder ?? -1) + 1;
  }
  private async nextTaskOrder(stageId: string) {
    const value = await this.prisma.sopTask.aggregate({
      where: { stageId },
      _max: { sortOrder: true },
    });
    return (value._max.sortOrder ?? -1) + 1;
  }
  private async nextChecklistOrder(taskId: string) {
    const value = await this.prisma.sopChecklistItem.aggregate({
      where: { taskId },
      _max: { sortOrder: true },
    });
    return (value._max.sortOrder ?? -1) + 1;
  }
  private async nextDeliverableOrder(taskId: string) {
    const value = await this.prisma.sopDeliverable.aggregate({
      where: { sopTaskId: taskId },
      _max: { sortOrder: true },
    });
    return (value._max.sortOrder ?? -1) + 1;
  }
  private async deliverableWithVersion(id: string) {
    const deliverable = await this.prisma.sopDeliverable.findUnique({
      where: { id },
      include: {
        templates: true,
        reviewCriteria: true,
        task: { include: { stage: { select: { sopVersionId: true } } } },
      },
    });
    if (!deliverable) throw this.notFound('SOP_DELIVERABLE_NOT_FOUND', 'SOP 交付物不存在');
    return deliverable;
  }
  private async templateWithVersion(id: string) {
    const template = await this.prisma.sopDeliverableTemplate.findUnique({
      where: { id },
      include: {
        deliverable: {
          include: { task: { include: { stage: { select: { sopVersionId: true } } } } },
        },
      },
    });
    if (!template) throw this.notFound('SOP_DELIVERABLE_TEMPLATE_NOT_FOUND', '交付物模板不存在');
    return template;
  }
  private async removeStoredObjects(objectKeys: string[], reason: string): Promise<void> {
    for (const objectKey of objectKeys) {
      try {
        await this.storage.delete(objectKey);
      } catch (error) {
        await this.recordCleanup(objectKey, reason, error);
      }
    }
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
        await this.recordCleanup(objectKey, reason, cleanupError);
      } catch (trackingError) {
        throw new AggregateError(
          [originalError, cleanupError, trackingError],
          'SOP 模板数据库写入及文件回滚追踪同时失败',
        );
      }
    }
  }
  private async recordCleanup(objectKey: string, reason: string, error: unknown): Promise<void> {
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
  private notFound(code: string, message: string) {
    return new NotFoundException({ code, message });
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeWeights } from '@pmp/shared-utils';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CloneVersionDto,
  CreateChecklistItemDto,
  CreateSopStageDto,
  CreateSopTaskDto,
  CreateSopTemplateDto,
  CreateSopVersionDto,
  UpdateSopStageDto,
  UpdateSopTaskDto,
} from './dto';

@Injectable()
export class SopService {
  constructor(private readonly prisma: PrismaService) {}
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
                  include: { checklistItems: { orderBy: { sortOrder: 'asc' } } },
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
              include: { checklistItems: { orderBy: { sortOrder: 'asc' } } },
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
      select: { sopVersionId: true },
    });
    if (!stage) throw this.notFound('SOP_STAGE_NOT_FOUND', '阶段不存在');
    await this.assertDraftVersion(stage.sopVersionId);
    await this.prisma.sopStage.delete({ where: { id } });
  }
  async createTask(stageId: string, dto: CreateSopTaskDto) {
    const stage = await this.prisma.sopStage.findUnique({
      where: { id: stageId },
      select: { sopVersionId: true },
    });
    if (!stage) throw this.notFound('SOP_STAGE_NOT_FOUND', '阶段不存在');
    await this.assertDraftVersion(stage.sopVersionId);
    this.validateDeliverable(dto);
    const sortOrder = dto.sortOrder ?? (await this.nextTaskOrder(stageId));
    return this.prisma.sopTask.create({
      data: {
        stageId,
        name: dto.name.trim(),
        description: dto.description,
        sortOrder,
        defaultDurationDays: dto.defaultDurationDays,
        required: dto.required ?? true,
        deliverableRequired: dto.deliverableRequired ?? false,
        deliverableName: dto.deliverableName,
        deliverableTemplate: dto.deliverableTemplate,
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
    this.validateDeliverable(dto);
    return this.prisma.sopTask.update({ where: { id }, data: { ...dto, name: dto.name.trim() } });
  }
  async deleteTask(id: string) {
    const task = await this.prisma.sopTask.findUnique({
      where: { id },
      include: { stage: { select: { sopVersionId: true } } },
    });
    if (!task) throw this.notFound('SOP_TASK_NOT_FOUND', 'SOP 任务不存在');
    await this.assertDraftVersion(task.stage.sopVersionId);
    await this.prisma.sopTask.delete({ where: { id } });
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
  async clone(versionId: string, dto: CloneVersionDto) {
    const source = await this.getVersion(versionId);
    const normalizedVersion = dto.version.toUpperCase().startsWith('V')
      ? dto.version.toUpperCase()
      : `V${dto.version}`;
    return this.prisma.$transaction(async (tx) =>
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
                  deliverableRequired: task.deliverableRequired,
                  deliverableName: task.deliverableName,
                  deliverableTemplate: task.deliverableTemplate,
                  checklistItems: {
                    create: task.checklistItems.map((item) => ({
                      stableKey: item.stableKey,
                      name: item.name,
                      sortOrder: item.sortOrder,
                      required: item.required,
                    })),
                  },
                })),
              },
            })),
          },
        },
        include: { stages: { include: { tasks: { include: { checklistItems: true } } } } },
      }),
    );
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
  private validateDeliverable(dto: { deliverableRequired?: boolean; deliverableName?: string }) {
    if (dto.deliverableRequired && !dto.deliverableName?.trim())
      throw new BadRequestException({
        code: 'DELIVERABLE_NAME_REQUIRED',
        message: '必需交付物必须填写名称',
      });
  }
  private notFound(code: string, message: string) {
    return new NotFoundException({ code, message });
  }
}

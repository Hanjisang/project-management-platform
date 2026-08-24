import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { stableJson } from '@pmp/shared-utils';
import { ProjectScopeService } from '../auth/project-scope.service';
import type { RequestUser } from '../common/types';
import { DeliverableReviewDecisionService } from '../documents/deliverable-review-decision.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../documents/storage.provider';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectWritable } from '../projects/project-mutation';
import type { GeneratePlanDto, SyncPlanDto } from './dto';
import { buildPlanDiff } from './plan-diff';

const planInclude = Prisma.validator<Prisma.ProjectPlanInclude>()({
  project: { select: { managerUserId: true, status: true } },
  stages: {
    orderBy: { sortOrder: 'asc' },
    include: {
      workItems: {
        orderBy: { sortOrder: 'asc' },
        include: {
          owner: { select: { id: true, displayName: true } },
          checklistItems: { orderBy: { sortOrder: 'asc' } },
          deliverables: {
            orderBy: { sortOrder: 'asc' },
            include: {
              templates: { orderBy: { createdAt: 'asc' } },
              reviewCriteria: { orderBy: { sortOrder: 'asc' } },
              documents: {
                where: { deletedAt: null },
                include: {
                  versions: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                      reviews: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                          findings: { orderBy: { sortOrder: 'asc' } },
                          criterionResults: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

const versionInclude = Prisma.validator<Prisma.SopVersionInclude>()({
  template: true,
  stages: {
    orderBy: { sortOrder: 'asc' },
    include: {
      tasks: {
        orderBy: { sortOrder: 'asc' },
        include: {
          checklistItems: { orderBy: { sortOrder: 'asc' } },
          deliverables: {
            orderBy: { sortOrder: 'asc' },
            include: { templates: true, reviewCriteria: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
    },
  },
});

type VersionTree = Prisma.SopVersionGetPayload<{ include: typeof versionInclude }>;

@Injectable()
export class ProjectPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly reviewDecision: DeliverableReviewDecisionService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async get(user: RequestUser, projectId: string) {
    await this.scope.assert(user, projectId);
    const plan = await this.loadPlan(projectId);
    if (!plan) throw this.notFound();
    return this.present(plan);
  }

  async generate(user: RequestUser, projectId: string, dto: GeneratePlanDto) {
    await this.scope.assert(user, projectId);
    const version = await this.loadVersion(dto.sopVersionId);
    if (!version || version.status !== 'PUBLISHED')
      throw new BadRequestException({
        code: 'SOP_VERSION_NOT_PUBLISHED',
        message: '只能使用已发布的 SOP 版本',
      });
    await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      const project = await tx.project.findFirst({ where: { id: projectId, deletedAt: null } });
      if (!project)
        throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '项目不存在' });

      const existingPlan = await tx.projectPlan.findUnique({
        where: { projectId },
        include: {
          stages: {
            orderBy: { sortOrder: 'asc' },
            include: {
              workItems: {
                include: {
                  checklistItems: { select: { completed: true } },
                  documents: { where: { deletedAt: null }, select: { id: true } },
                },
              },
            },
          },
        },
      });

      if (!existingPlan) {
        await this.createPlan(tx, project, version, user.id);
        return;
      }

      if (!this.canAdoptTemporaryPlan(existingPlan))
        throw new ConflictException({
          code: 'PROJECT_PLAN_EXISTS',
          message: '项目已有正式执行计划或已有执行记录，请使用同步或项目变更功能',
        });

      await this.adoptTemporaryPlan(tx, existingPlan, project, version, user.id);
    });
    return this.get(user, projectId);
  }

  async downloadDeliverableTemplate(user: RequestUser, id: string) {
    const template = await this.prisma.projectDeliverableTemplate.findUnique({
      where: { id },
      include: { projectDeliverable: { include: { workItem: true } } },
    });
    if (!template)
      throw new NotFoundException({
        code: 'PROJECT_DELIVERABLE_TEMPLATE_NOT_FOUND',
        message: '项目交付物模板不存在',
      });
    await this.scope.assert(user, template.projectDeliverable.workItem.projectId);
    return {
      buffer: await this.storage.get(template.objectKey),
      fileName: template.fileName,
      mimeType: template.mimeType,
    };
  }

  async previewSync(user: RequestUser, projectId: string, sopVersionId: string) {
    await this.scope.assert(user, projectId);
    const [plan, version] = await Promise.all([
      this.loadPlan(projectId),
      this.loadVersion(sopVersionId),
    ]);
    if (!plan) throw this.notFound();
    if (!version || version.status !== 'PUBLISHED')
      throw new BadRequestException({
        code: 'SOP_VERSION_NOT_PUBLISHED',
        message: '目标 SOP 版本未发布',
      });
    const currentStages = plan.stages.map((stage) => ({
      ...stage,
      tasks: stage.workItems.map((item) => ({ ...item, sourceTaskKey: item.sourceSopTaskKey })),
    }));
    const diff = buildPlanDiff(currentStages, version.stages);
    return {
      fromVersionId: plan.sourceSopVersionId,
      toVersionId: version.id,
      diff,
      diffHash: this.hash(diff),
    };
  }

  async sync(user: RequestUser, projectId: string, dto: SyncPlanDto) {
    const preview = await this.previewSync(user, projectId, dto.sopVersionId);
    if (preview.diffHash !== dto.acceptedDiffHash)
      throw new ConflictException({
        code: 'SOP_SYNC_DIFF_CHANGED',
        message: 'SOP 同步差异已变化，请重新预览并确认',
      });
    const version = await this.loadVersion(dto.sopVersionId);
    if (!version) throw this.notFound();
    await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project)
        throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '项目不存在' });
      if (!['DRAFT', 'NOT_STARTED'].includes(project.status))
        throw new ConflictException({
          code: 'SOP_SYNC_REQUIRES_CHANGE_REQUEST',
          message: '已开始项目必须通过项目变更应用 SOP 差异',
        });
      const activity = await tx.projectWorkItem.count({
        where: {
          projectId,
          OR: [
            { progress: { gt: 0 } },
            { status: { not: 'TODO' } },
            { checklistItems: { some: { completed: true } } },
            { documents: { some: { deletedAt: null } } },
          ],
        },
      });
      if (activity)
        throw new ConflictException({
          code: 'SOP_SYNC_REQUIRES_CHANGE_REQUEST',
          message: '项目已有执行记录，必须通过项目变更同步 SOP',
        });
      await tx.projectPlan.delete({ where: { projectId } });
      await this.createPlan(tx, project, version, user.id);
    });
    return { ...(await this.get(user, projectId)), appliedDiff: preview.diff };
  }

  private canAdoptTemporaryPlan(plan: {
    sourceSopVersionId: string | null;
    stages: Array<{
      isCustom: boolean;
      sourceStageId: string | null;
      sourceStageKey: string | null;
      workItems: Array<{
        sourceType: string;
        isCustom: boolean;
        status: string;
        progress: number;
        checklistItems: Array<{ completed: boolean }>;
        documents: Array<{ id: string }>;
      }>;
    }>;
  }): boolean {
    if (plan.sourceSopVersionId) return false;
    return plan.stages.every(
      (stage) =>
        stage.isCustom &&
        !stage.sourceStageId &&
        !stage.sourceStageKey &&
        stage.workItems.every(
          (item) =>
            item.sourceType === 'MANUAL' &&
            item.isCustom &&
            item.status === 'TODO' &&
            item.progress === 0 &&
            !item.checklistItems.some((check) => check.completed) &&
            item.documents.length === 0,
        ),
    );
  }

  private async adoptTemporaryPlan(
    tx: Prisma.TransactionClient,
    plan: {
      id: string;
      stages: Array<{ id: string; sortOrder: number }>;
    },
    project: { id: string; managerUserId: string; plannedStartDate: Date | null },
    version: VersionTree,
    userId: string,
  ) {
    const maxSourceSortOrder = version.stages.reduce(
      (max, stage) => Math.max(max, stage.sortOrder),
      -1,
    );
    const maxExistingSortOrder = plan.stages.reduce(
      (max, stage) => Math.max(max, stage.sortOrder),
      -1,
    );
    const temporaryBase = Math.max(maxSourceSortOrder, maxExistingSortOrder) + plan.stages.length + 1000;

    for (const [index, stage] of plan.stages.entries())
      await tx.projectStage.update({
        where: { id: stage.id },
        data: { sortOrder: temporaryBase + index },
      });

    await tx.projectPlan.update({
      where: { id: plan.id },
      data: {
        sourceSopVersionId: version.id,
        name: `${version.template.name} ${version.version}`,
        progress: 0,
        generatedAt: new Date(),
        syncedAt: null,
      },
    });

    await this.createPlanStages(tx, plan.id, project, version, userId);

    for (const [index, stage] of plan.stages.entries())
      await tx.projectStage.update({
        where: { id: stage.id },
        data: { sortOrder: maxSourceSortOrder + 1 + index },
      });
  }

  private async createPlan(
    tx: Prisma.TransactionClient,
    project: { id: string; managerUserId: string; plannedStartDate: Date | null },
    version: VersionTree,
    userId: string,
  ) {
    const plan = await tx.projectPlan.create({
      data: {
        projectId: project.id,
        sourceSopVersionId: version.id,
        name: `${version.template.name} ${version.version}`,
      },
    });
    await this.createPlanStages(tx, plan.id, project, version, userId);
    return plan;
  }

  private async createPlanStages(
    tx: Prisma.TransactionClient,
    planId: string,
    project: { id: string; managerUserId: string; plannedStartDate: Date | null },
    version: VersionTree,
    userId: string,
  ) {
    let cursor = project.plannedStartDate ?? new Date();
    for (const sourceStage of version.stages) {
      const stageStart = cursor;
      const stageEnd = this.addDays(stageStart, Math.max(1, sourceStage.defaultDurationDays) - 1);
      const stage = await tx.projectStage.create({
        data: {
          planId,
          sourceStageId: sourceStage.id,
          sourceStageKey: sourceStage.stableKey,
          name: sourceStage.name,
          description: sourceStage.description,
          sortOrder: sourceStage.sortOrder,
          weight: sourceStage.weight,
          plannedStartDate: stageStart,
          plannedEndDate: stageEnd,
        },
      });
      let taskCursor = stageStart;
      for (const sourceTask of sourceStage.tasks) {
        const taskStart = taskCursor;
        const taskEnd = this.addDays(taskStart, Math.max(1, sourceTask.defaultDurationDays) - 1);
        taskCursor = this.addDays(taskEnd, 1);
        const workItem = await tx.projectWorkItem.create({
          data: {
            projectId: project.id,
            planStageId: stage.id,
            sourceSopTaskId: sourceTask.id,
            sourceSopTaskKey: sourceTask.stableKey,
            name: sourceTask.name,
            description: sourceTask.description,
            ownerUserId: project.managerUserId,
            plannedStartDate: taskStart,
            plannedEndDate: taskEnd,
            required: sourceTask.required,
            sourceType: 'SOP',
            sortOrder: sourceTask.sortOrder,
            weight: sourceTask.weight,
            createdById: userId,
          },
        });
        if (sourceTask.checklistItems.length)
          await tx.projectChecklistItem.createMany({
            data: sourceTask.checklistItems.map((item) => ({
              workItemId: workItem.id,
              sourceItemId: item.id,
              sourceItemKey: item.stableKey,
              name: item.name,
              sortOrder: item.sortOrder,
              required: item.required,
            })),
          });
        for (const sourceDeliverable of sourceTask.deliverables) {
          await tx.projectDeliverable.create({
            data: {
              workItemId: workItem.id,
              sourceDeliverableId: sourceDeliverable.id,
              sourceDeliverableKey: sourceDeliverable.stableKey,
              name: sourceDeliverable.name,
              description: sourceDeliverable.description,
              required: sourceDeliverable.required,
              sortOrder: sourceDeliverable.sortOrder,
              reviewMode: sourceDeliverable.reviewMode,
              aiAutoApproveThreshold: sourceDeliverable.aiAutoApproveThreshold,
              aiReviewInstruction: sourceDeliverable.aiReviewInstruction,
              templates: {
                create: sourceDeliverable.templates.map((template) => ({
                  sourceTemplateId: template.id,
                  fileName: template.fileName,
                  objectKey: template.objectKey,
                  mimeType: template.mimeType,
                  size: template.size,
                  checksum: template.checksum,
                })),
              },
              reviewCriteria: {
                create: sourceDeliverable.reviewCriteria.map((criterion) => ({
                  sourceCriterionId: criterion.id,
                  sourceCriterionKey: criterion.stableKey,
                  name: criterion.name,
                  description: criterion.description,
                  required: criterion.required,
                  weight: criterion.weight,
                  sortOrder: criterion.sortOrder,
                })),
              },
            },
          });
        }
      }
      cursor = this.addDays(stageEnd, 1);
    }
  }

  private async loadPlan(projectId: string) {
    return this.prisma.projectPlan.findUnique({ where: { projectId }, include: planInclude });
  }
  private async loadVersion(id: string) {
    return this.prisma.sopVersion.findUnique({ where: { id }, include: versionInclude });
  }
  private present(plan: NonNullable<Awaited<ReturnType<ProjectPlansService['loadPlan']>>>) {
    return {
      ...plan,
      stages: plan.stages.map((stage) => ({
        ...stage,
        workItems: stage.workItems.map((workItem) => ({
          ...workItem,
          checklistSummary: {
            completed: workItem.checklistItems.filter((item) => item.required && item.completed)
              .length,
            total: workItem.checklistItems.filter((item) => item.required).length,
          },
          deliverables: workItem.deliverables.map((deliverable) => ({
            ...deliverable,
            ...this.reviewDecision.decide(deliverable),
          })),
        })),
      })),
    };
  }
  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
  private hash(value: unknown) {
    return createHash('sha256').update(stableJson(value)).digest('hex');
  }
  private notFound() {
    return new NotFoundException({ code: 'PROJECT_PLAN_NOT_FOUND', message: '项目实施计划不存在' });
  }
}

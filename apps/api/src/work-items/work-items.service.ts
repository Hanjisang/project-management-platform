import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ProjectWorkItem } from '@prisma/client';
import type { RequestUser } from '../common/types';
import { DeliverableReviewDecisionService } from '../documents/deliverable-review-decision.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../project-plans/progress.service';
import { assertProjectWritable } from '../projects/project-mutation';
import { ProjectScopeService } from '../auth/project-scope.service';
import { ProjectsService } from '../projects/projects.service';
import type {
  CancelWorkItemDto,
  CreateWorkItemDto,
  UpdateWorkItemDto,
  WorkItemListQueryDto,
} from './dto';

const executionInclude = Prisma.validator<Prisma.ProjectWorkItemInclude>()({
  project: { select: { id: true, code: true, name: true } },
  stage: { select: { id: true, name: true, planId: true } },
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
      },
    },
  },
  children: { orderBy: { sortOrder: 'asc' } },
  zentaoSync: true,
});

type WorkItemTree = Prisma.ProjectWorkItemGetPayload<{ include: typeof executionInclude }>;
type WorkItemProvenance = { sourceType: 'MESSAGE'; sourceId: string };

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly projects: ProjectsService,
    private readonly progress: ProgressService,
    private readonly reviewDecision: DeliverableReviewDecisionService,
  ) {}

  async list(user: RequestUser, query: WorkItemListQueryDto) {
    if (query.projectId) await this.scope.assert(user, query.projectId);
    const where: Prisma.ProjectWorkItemWhereInput = {
      project: this.scope.where(user),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectWorkItem.findMany({
        where,
        include: executionInclude,
        orderBy: [{ plannedEndDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.projectWorkItem.count({ where }),
    ]);
    const provenance = await this.provenanceFor(items.map((item) => item.id));
    return {
      items: items.map((item) => this.present(item, provenance.get(item.id))),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(user: RequestUser, id: string) {
    const item = await this.prisma.projectWorkItem.findUnique({
      where: { id },
      include: executionInclude,
    });
    if (!item) throw this.notFound();
    await this.scope.assert(user, item.projectId);
    const provenance = await this.provenanceFor([item.id]);
    return this.present(item, provenance.get(item.id));
  }

  async execution(user: RequestUser, projectId: string) {
    await this.scope.assert(user, projectId);
    const [project, plan, baseline, pendingChanges] = await Promise.all([
      this.prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        include: {
          manager: { select: { id: true, displayName: true } },
          approver: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.projectPlan.findUnique({
        where: { projectId },
        include: {
          stages: {
            orderBy: { sortOrder: 'asc' },
            include: { workItems: { orderBy: { sortOrder: 'asc' }, include: executionInclude } },
          },
        },
      }),
      this.prisma.projectBaseline.findFirst({ where: { projectId }, orderBy: { version: 'desc' } }),
      this.prisma.projectChangeRequest.count({
        where: { projectId, status: { in: ['PENDING_APPROVAL', 'APPROVED'] } },
      }),
    ]);
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '项目不存在' });
    const rawStages = plan?.stages ?? [];
    const provenance = await this.provenanceFor(
      rawStages.flatMap((stage) => stage.workItems.map((item) => item.id)),
    );
    const stages = rawStages.map((stage) => ({
      ...stage,
      workItems: stage.workItems.map((item) => this.present(item, provenance.get(item.id))),
    }));
    const flat = stages.flatMap((stage) => stage.workItems);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      project,
      plan: plan ? { id: plan.id, name: plan.name, progress: plan.progress } : null,
      baseline,
      stages,
      attentionCounts: {
        overdueWorkItems: flat.filter(
          (item) =>
            item.plannedEndDate &&
            new Date(item.plannedEndDate) < today &&
            !['DONE', 'CANCELLED'].includes(item.status),
        ).length,
        blockedWorkItems: flat.filter((item) => item.status === 'BLOCKED').length,
        unsubmittedRequiredDeliverables: flat.reduce(
          (sum, item) =>
            sum +
            item.deliverables.filter(
              (deliverable) =>
                deliverable.required && deliverable.effectiveStatus === 'NOT_SUBMITTED',
            ).length,
          0,
        ),
        pendingReviews: flat.reduce(
          (sum, item) =>
            sum +
            item.deliverables.filter((deliverable) =>
              ['AI_PENDING', 'HUMAN_REVIEW_REQUIRED'].includes(deliverable.effectiveStatus),
            ).length,
          0,
        ),
        pendingChanges,
      },
    };
  }

  async create(user: RequestUser, projectId: string, dto: CreateWorkItemDto) {
    await this.scope.assert(user, projectId);
    await this.validateOwner(projectId, dto.ownerUserId);
    if (dto.plannedStartDate && dto.plannedEndDate && dto.plannedStartDate > dto.plannedEndDate)
      throw this.invalidDates();
    const parent = dto.parentWorkItemId
      ? await this.prisma.projectWorkItem.findUnique({ where: { id: dto.parentWorkItemId } })
      : null;
    if (dto.parentWorkItemId && (!parent || parent.projectId !== projectId))
      throw new BadRequestException({
        code: 'WORK_ITEM_PARENT_INVALID',
        message: '父任务不属于该项目',
      });
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
      if (project.status === 'ACTIVE' && !user.isAdministrator && project.managerUserId !== user.id)
        throw new ForbiddenException({
          code: 'PROJECT_CHANGE_MANAGER_REQUIRED',
          message: '进行中项目的一般计划调整只能由项目经理执行',
        });
      if (project.status === 'ACTIVE' && dto.required === true)
        throw new ConflictException({
          code: 'PROJECT_CHANGE_APPROVAL_REQUIRED',
          message: '进行中项目新增 Required 核心任务必须通过项目变更',
        });
      let stageId = parent?.planStageId ?? dto.planStageId;
      if (stageId) {
        const valid = await tx.projectStage.count({ where: { id: stageId, plan: { projectId } } });
        if (!valid)
          throw new BadRequestException({
            code: 'WORK_ITEM_STAGE_INVALID',
            message: '阶段不属于该项目',
          });
      } else {
        const plan = await tx.projectPlan.findUnique({ where: { projectId } });
        if (!plan)
          throw new ConflictException({
            code: 'PROJECT_PLAN_REQUIRED',
            message: '请先生成项目执行计划',
          });
        const existing = await tx.projectStage.findFirst({
          where: { planId: plan.id, isCustom: true, name: '临时任务' },
        });
        stageId = existing?.id;
        if (!stageId) {
          const aggregate = await tx.projectStage.aggregate({
            where: { planId: plan.id },
            _max: { sortOrder: true },
          });
          stageId = (
            await tx.projectStage.create({
              data: {
                planId: plan.id,
                name: '临时任务',
                description: '项目执行过程中产生的人工任务',
                sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
                isCustom: true,
              },
            })
          ).id;
        }
      }
      const aggregate = await tx.projectWorkItem.aggregate({
        where: { planStageId: stageId },
        _max: { sortOrder: true },
      });
      const created = await tx.projectWorkItem.create({
        data: {
          projectId,
          planStageId: stageId,
          parentWorkItemId: parent?.id,
          name: dto.name.trim(),
          description: dto.description,
          ownerUserId: dto.ownerUserId,
          priority: dto.priority ?? 'MEDIUM',
          plannedStartDate: dto.plannedStartDate,
          plannedEndDate: dto.plannedEndDate,
          required: dto.required ?? false,
          sourceType: 'MANUAL',
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          weight: 0,
          isCustom: true,
          createdById: user.id,
        },
      });
      if (project.status === 'ACTIVE')
        await this.recordAdjustment(
          tx,
          project,
          user.id,
          'MANUAL_WORK_ITEM_CREATED',
          created.id,
          '不存在',
          this.summary(created),
          '项目执行中的一般人工任务',
          created.ownerUserId,
        );
      return created;
    });
  }

  async update(user: RequestUser, id: string, dto: UpdateWorkItemDto) {
    const existing = await this.loadScoped(user, id);
    await this.validateOwner(existing.projectId, dto.ownerUserId);
    const start = dto.plannedStartDate ?? existing.plannedStartDate;
    const end = dto.plannedEndDate ?? existing.plannedEndDate;
    if (start && end && start > end) throw this.invalidDates();
    if (dto.status === 'DONE')
      throw new ConflictException({
        code: 'WORK_ITEM_COMPLETE_ENDPOINT_REQUIRED',
        message: '请使用完成任务操作',
      });
    if (dto.status === 'CANCELLED')
      throw new ConflictException({
        code: 'WORK_ITEM_CANCEL_ENDPOINT_REQUIRED',
        message: '请使用取消任务操作',
      });
    if (dto.progress !== undefined) {
      const requiredUnits = await this.prisma.projectWorkItem.findUnique({
        where: { id },
        select: {
          _count: {
            select: {
              checklistItems: { where: { required: true } },
              deliverables: { where: { required: true } },
            },
          },
        },
      });
      if (
        (requiredUnits?._count.checklistItems ?? 0) + (requiredUnits?._count.deliverables ?? 0) > 0
      )
        throw new ConflictException({
          code: 'WORK_ITEM_PROGRESS_MANAGED',
          message: '包含必需检查项或交付物的任务进度由系统计算',
        });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, existing.projectId);
      const project = await tx.project.findUniqueOrThrow({ where: { id: existing.projectId } });
      const result = await tx.projectWorkItem.update({ where: { id }, data: dto });
      const planningChanged = [
        'name',
        'description',
        'ownerUserId',
        'plannedStartDate',
        'plannedEndDate',
        'priority',
      ].some((key) => key in dto);
      if (project.status === 'ACTIVE' && planningChanged)
        await this.recordAdjustment(
          tx,
          project,
          user.id,
          'WORK_ITEM_PLAN_UPDATED',
          id,
          this.summary(existing),
          this.summary(result),
          '任务一般计划字段调整',
          result.ownerUserId,
        );
      return result;
    });
    await this.progress.recomputeStage(existing.planStageId);
    await this.projects.recomputeHealth(existing.projectId);
    return updated;
  }

  async complete(user: RequestUser, id: string) {
    const item = await this.loadScoped(user, id, true);
    if (item.status === 'DONE') return item;
    if (item.status === 'CANCELLED')
      throw new ConflictException({
        code: 'WORK_ITEM_STATUS_TRANSITION_INVALID',
        message: '已取消任务不能完成',
      });
    const checklist = item.checklistItems
      .filter((entry) => entry.required && !entry.completed)
      .map(({ id: itemId, name }) => ({ id: itemId, name }));
    const deliverables = item.deliverables
      .filter((entry) => entry.required)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        status: this.reviewDecision.decide(entry).effectiveStatus,
      }))
      .filter((entry) => entry.status !== 'APPROVED');
    if (checklist.length || deliverables.length)
      throw new ConflictException({
        code: 'WORK_ITEM_COMPLETION_BLOCKED',
        message: '必需检查项或必交资料尚未完成',
        details: { checklist, deliverables },
      });
    const updated = await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, item.projectId);
      return tx.projectWorkItem.update({
        where: { id },
        data: {
          status: 'DONE',
          progress: 100,
          actualStartDate: item.actualStartDate ?? new Date(),
          actualEndDate: item.actualEndDate ?? new Date(),
        },
      });
    });
    await this.progress.recomputeStage(item.planStageId);
    await this.projects.recomputeHealth(item.projectId);
    return updated;
  }

  async cancel(user: RequestUser, id: string, dto: CancelWorkItemDto) {
    const item = await this.loadScoped(user, id);
    if (item.status === 'CANCELLED') return item;
    if (item.status === 'DONE')
      throw new ConflictException({
        code: 'WORK_ITEM_STATUS_TRANSITION_INVALID',
        message: '已完成任务不能取消',
      });
    const updated = await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, item.projectId);
      const project = await tx.project.findUniqueOrThrow({ where: { id: item.projectId } });
      if (project.status === 'ACTIVE' && item.required)
        throw new ConflictException({
          code: 'PROJECT_CHANGE_APPROVAL_REQUIRED',
          message: '取消 Required 核心任务必须通过项目变更',
        });
      const result = await tx.projectWorkItem.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      if (project.status === 'ACTIVE')
        await this.recordAdjustment(
          tx,
          project,
          user.id,
          'MANUAL_WORK_ITEM_CANCELLED',
          id,
          this.summary(item),
          this.summary(result),
          dto.reason || '取消一般人工任务并保留执行历史',
          item.ownerUserId,
        );
      return result;
    });
    await this.progress.recomputeStage(item.planStageId);
    return updated;
  }

  async updateChecklist(user: RequestUser, id: string, completed: boolean) {
    const entry = await this.prisma.projectChecklistItem.findUnique({
      where: { id },
      include: { workItem: true },
    });
    if (!entry)
      throw new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: '检查项不存在' });
    await this.scope.assert(user, entry.workItem.projectId);
    await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, entry.workItem.projectId);
      await tx.projectChecklistItem.update({
        where: { id },
        data: {
          completed,
          completedAt: completed ? new Date() : null,
          completedById: completed ? user.id : null,
        },
      });
      await this.progress.recomputeWorkItem(entry.workItemId, tx);
    });
    return this.prisma.projectChecklistItem.findUnique({ where: { id } });
  }

  private present(item: WorkItemTree, provenance?: WorkItemProvenance) {
    const persistedProvenance = item.sourceId
      ? { sourceType: item.sourceType, sourceId: item.sourceId }
      : undefined;
    return {
      ...item,
      sourceType: persistedProvenance?.sourceType ?? provenance?.sourceType ?? item.sourceType,
      sourceId: persistedProvenance?.sourceId ?? provenance?.sourceId,
      checklistSummary: {
        completed: item.checklistItems.filter((entry) => entry.required && entry.completed).length,
        total: item.checklistItems.filter((entry) => entry.required).length,
      },
      deliverableSummary: {
        approved: item.deliverables.filter(
          (entry) => entry.required && this.reviewDecision.decide(entry).approved,
        ).length,
        total: item.deliverables.filter((entry) => entry.required).length,
      },
      deliverables: item.deliverables.map((entry) => ({
        ...entry,
        ...this.reviewDecision.decide(entry),
        latestVersion:
          entry.documents
            .flatMap((document) => document.versions)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      })),
    };
  }

  private async provenanceFor(ids: string[]): Promise<Map<string, WorkItemProvenance>> {
    const result = new Map<string, WorkItemProvenance>();
    if (!ids.length) return result;
    const actions = await this.prisma.pendingAction.findMany({
      where: {
        resultResourceType: 'ProjectWorkItem',
        resultResourceId: { in: ids },
        status: 'CONFIRMED',
      },
      select: { resultResourceId: true, messageId: true, confirmedAt: true },
      orderBy: { confirmedAt: 'desc' },
    });
    for (const action of actions) {
      if (!action.resultResourceId || result.has(action.resultResourceId)) continue;
      result.set(action.resultResourceId, { sourceType: 'MESSAGE', sourceId: action.messageId });
    }
    return result;
  }

  private async loadScoped(user: RequestUser, id: string, includeExecution: true): Promise<WorkItemTree>;
  private async loadScoped(
    user: RequestUser,
    id: string,
    includeExecution?: false,
  ): Promise<ProjectWorkItem>;
  private async loadScoped(
    user: RequestUser,
    id: string,
    includeExecution = false,
  ): Promise<ProjectWorkItem | WorkItemTree> {
    const item = includeExecution
      ? await this.prisma.projectWorkItem.findUnique({ where: { id }, include: executionInclude })
      : await this.prisma.projectWorkItem.findUnique({ where: { id } });
    if (!item) throw this.notFound();
    await this.scope.assert(user, item.projectId);
    return item;
  }
  private async validateOwner(projectId: string, ownerUserId?: string) {
    if (
      ownerUserId &&
      !(await this.prisma.projectMember.count({ where: { projectId, userId: ownerUserId } }))
    )
      throw new BadRequestException({
        code: 'WORK_ITEM_OWNER_INVALID',
        message: '负责人必须是项目成员',
      });
  }
  private async recordAdjustment(
    tx: Prisma.TransactionClient,
    project: { id: string; approverUserId: string | null },
    operatorUserId: string,
    adjustmentType: string,
    entityId: string,
    beforeSummary: string,
    afterSummary: string,
    reason: string,
    ownerUserId?: string | null,
  ) {
    const baseline = await tx.projectBaseline.findFirst({
      where: { projectId: project.id },
      orderBy: { version: 'desc' },
    });
    if (!baseline)
      throw new ConflictException({
        code: 'PROJECT_BASELINE_REQUIRED',
        message: '进行中项目缺少批准基线',
      });
    const log = await tx.projectAdjustmentLog.create({
      data: {
        projectId: project.id,
        operatorUserId,
        adjustmentType,
        entityType: 'ProjectWorkItem',
        entityId,
        beforeSummary,
        afterSummary,
        reason,
        baselineId: baseline.id,
        changeRate: new Prisma.Decimal(0),
      },
    });
    const recipients = [
      ...new Set(
        [project.approverUserId, ownerUserId].filter((value): value is string => Boolean(value)),
      ),
    ];
    if (recipients.length)
      await tx.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          projectId: project.id,
          type: 'PLAN_ADJUSTED' as const,
          title: '项目执行计划调整已直接生效',
          content: reason,
          resourceType: 'ProjectAdjustmentLog',
          resourceId: log.id,
        })),
      });
  }
  private summary(item: {
    name: string;
    ownerUserId?: string | null;
    plannedStartDate?: Date | null;
    plannedEndDate?: Date | null;
    status?: string;
    priority?: string;
  }) {
    return JSON.stringify({
      name: item.name,
      ownerUserId: item.ownerUserId ?? null,
      plannedStartDate: item.plannedStartDate?.toISOString().slice(0, 10) ?? null,
      plannedEndDate: item.plannedEndDate?.toISOString().slice(0, 10) ?? null,
      status: item.status,
      priority: item.priority,
    });
  }
  private invalidDates() {
    return new BadRequestException({
      code: 'WORK_ITEM_DATE_INVALID',
      message: '计划开始日期不能晚于结束日期',
    });
  }
  private notFound() {
    return new NotFoundException({ code: 'WORK_ITEM_NOT_FOUND', message: '任务不存在' });
  }
}

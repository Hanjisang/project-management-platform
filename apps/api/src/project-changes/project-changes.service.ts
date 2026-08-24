import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ProjectScopeService } from '../auth/project-scope.service';
import type { RequestUser } from '../common/types';
import { ProgressService } from '../project-plans/progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectWritable } from '../projects/project-mutation';
import { AI_PROVIDER, type AiProvider } from '../integrations/ai/ai.provider';
import { classifyProjectChange } from './change-impact-classifier';
import type { ChangePreflightDto, CreateProjectChangeDto, DirectProjectAdjustmentDto } from './dto';

const dateValue = z.coerce.date();
const projectDatePayload = z.object({ plannedCompletionDate: dateValue }).strict();
const stagePayload = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    sortOrder: z.number().int().min(0).optional(),
    plannedStartDate: dateValue.optional(),
    plannedEndDate: dateValue.optional(),
  })
  .strict();
const workItemPayload = z
  .object({
    planStageId: z.string(),
    parentWorkItemId: z.string().optional(),
    name: z.string().min(1).max(240),
    description: z.string().max(10000).optional(),
    ownerUserId: z.string().optional(),
    required: z.boolean().default(true),
    plannedStartDate: dateValue.optional(),
    plannedEndDate: dateValue.optional(),
  })
  .strict();
const updateWorkItemPayload = z
  .object({
    name: z.string().min(1).max(240).optional(),
    description: z.string().max(10000).optional(),
    ownerUserId: z.string().nullable().optional(),
    plannedStartDate: dateValue.optional(),
    plannedEndDate: dateValue.optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  })
  .strict();
const checklistPayload = z
  .object({
    workItemId: z.string(),
    name: z.string().min(1).max(200),
    required: z.boolean().default(true),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();
const deliverablePayload = z
  .object({
    workItemId: z.string(),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    required: z.boolean().default(true),
    reviewMode: z
      .enum(['AI_WITH_HUMAN_OVERRIDE', 'AI_THEN_HUMAN_REQUIRED', 'HUMAN_ONLY'])
      .default('HUMAN_ONLY'),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();
const revisionPayload = z.object({ reason: z.string().min(1).max(5000) }).strict();
const ownerPayload = z.object({ ownerUserId: z.string() }).strict();

@Injectable()
export class ProjectChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly progress: ProgressService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async list(user: RequestUser, projectId: string) {
    await this.scope.assert(user, projectId);
    return this.prisma.projectChangeRequest.findMany({
      where: { projectId },
      include: {
        requestedBy: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
        _count: { select: { operations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async get(user: RequestUser, id: string) {
    const change = await this.prisma.projectChangeRequest.findUnique({
      where: { id },
      include: {
        project: true,
        requestedBy: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
        operations: { orderBy: { sortOrder: 'asc' } },
        baseline: true,
      },
    });
    if (!change) throw this.notFound();
    await this.scope.assert(user, change.projectId);
    return change;
  }

  async preflight(user: RequestUser, projectId: string, dto: ChangePreflightDto) {
    await this.scope.assert(user, projectId);
    await this.assertManager(user, projectId);
    const baseline = await this.latestBaseline(projectId);
    return classifyProjectChange({
      baselineStart: baseline.plannedStartDate,
      baselineCompletion: baseline.plannedCompletionDate,
      proposedCompletion: dto.proposedCompletionDate,
      scopeChange: dto.scopeChange,
    });
  }

  async directAdjustment(user: RequestUser, projectId: string, dto: DirectProjectAdjustmentDto) {
    await this.scope.assert(user, projectId);
    const project = await this.assertManager(user, projectId);
    const baseline = await this.latestBaseline(projectId);
    const impact = classifyProjectChange({
      baselineStart: baseline.plannedStartDate,
      baselineCompletion: baseline.plannedCompletionDate,
      proposedCompletion: dto.proposedCompletionDate,
    });
    if (impact.classification !== 'DIRECT_ADJUSTMENT')
      throw new ConflictException({
        code: 'PROJECT_CHANGE_APPROVAL_REQUIRED',
        message: '本次调整超过批准基线 ±20%，必须提交项目变更',
        details: impact,
      });
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      await tx.project.update({
        where: { id: projectId },
        data: { plannedGoLiveDate: dto.proposedCompletionDate },
      });
      const log = await tx.projectAdjustmentLog.create({
        data: {
          projectId,
          operatorUserId: user.id,
          adjustmentType: 'PROJECT_COMPLETION_DATE',
          entityType: 'Project',
          entityId: projectId,
          beforeSummary: project.plannedGoLiveDate?.toISOString() ?? '未设置',
          afterSummary: dto.proposedCompletionDate.toISOString(),
          reason: dto.reason,
          baselineId: baseline.id,
          completionDateBefore: project.plannedGoLiveDate,
          completionDateAfter: dto.proposedCompletionDate,
          changeRate: new Prisma.Decimal(impact.changeRate),
        },
      });
      if (project.approverUserId)
        await tx.notification.create({
          data: {
            userId: project.approverUserId,
            projectId,
            type: 'PLAN_ADJUSTED',
            title: '项目计划调整已直接生效',
            content: `总体完成时间相对批准基线变化 ${impact.changeRate}%`,
            resourceType: 'ProjectAdjustmentLog',
            resourceId: log.id,
          },
        });
      return { log, impact };
    });
  }

  async create(user: RequestUser, projectId: string, dto: CreateProjectChangeDto) {
    await this.scope.assert(user, projectId);
    const project = await this.assertManager(user, projectId);
    if (!project.approverUserId)
      throw new ConflictException({
        code: 'PROJECT_CHANGE_APPROVER_MISMATCH',
        message: '项目未配置审批负责人',
      });
    dto.operations.forEach((operation) =>
      this.validateOperation(operation.operationType, operation.payload),
    );
    const baseline = await this.latestBaseline(projectId);
    const aiImpactSummary = await this.buildAiImpact(project, baseline, dto);
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      const count = await tx.projectChangeRequest.count({ where: { projectId } });
      return tx.projectChangeRequest.create({
        data: {
          projectId,
          code: `CR-${String(count + 1).padStart(3, '0')}`,
          title: dto.title.trim(),
          description: dto.description,
          changeType: dto.changeType,
          reason: dto.reason,
          source: dto.source,
          requestedByUserId: user.id,
          approverUserId: project.approverUserId!,
          aiImpactSummary: JSON.stringify(aiImpactSummary),
          operations: {
            create: dto.operations.map((operation, sortOrder) => ({
              operationType: operation.operationType,
              entityId: operation.entityId,
              sortOrder,
              payload: operation.payload,
            })),
          },
        },
        include: { operations: true },
      });
    });
  }

  private async buildAiImpact(
    project: {
      id: string;
      name: string;
      plannedStartDate: Date | null;
      plannedGoLiveDate: Date | null;
    },
    baseline: { version: number; plannedStartDate: Date; plannedCompletionDate: Date },
    dto: CreateProjectChangeDto,
  ) {
    const ruleSummary = {
      status: this.ai.status().configured ? 'AI_PENDING' : 'AI_NOT_CONFIGURED',
      provider: this.ai.status().provider,
      summary: '确定性规则已确认该变更必须经过项目审批；AI 分析不参与授权。',
      scheduleImpact: '以最新批准基线为比较对象，时间阈值由系统规则计算。',
      scopeImpact: `${dto.operations.length} 项结构化变更操作将在批准后事务应用。`,
      risks: [] as Array<{ severity: string; title: string; mitigation: string }>,
      recommendations: ['审批前复核结构化 Diff、负责人、完成日期和验收标准。'],
    };
    if (!this.ai.status().configured) return ruleSummary;
    try {
      const result = await this.ai.analyzeProjectChange({
        project: {
          id: project.id,
          name: project.name,
          plannedStartDate: (project.plannedStartDate ?? baseline.plannedStartDate)
            .toISOString()
            .slice(0, 10),
          plannedCompletionDate: (project.plannedGoLiveDate ?? baseline.plannedCompletionDate)
            .toISOString()
            .slice(0, 10),
        },
        baseline: {
          version: baseline.version,
          plannedStartDate: baseline.plannedStartDate.toISOString().slice(0, 10),
          plannedCompletionDate: baseline.plannedCompletionDate.toISOString().slice(0, 10),
        },
        change: {
          title: dto.title,
          description: dto.description,
          reason: dto.reason,
          changeType: dto.changeType,
          operations: dto.operations,
        },
      });
      return { status: 'SUCCEEDED', provider: this.ai.status().provider, ...result };
    } catch (error) {
      return {
        ...ruleSummary,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async submit(user: RequestUser, id: string) {
    const change = await this.get(user, id);
    await this.assertManager(user, change.projectId);
    if (change.status !== 'DRAFT') throw this.invalidState(change.status);
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, change.projectId);
      const updated = await tx.projectChangeRequest.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL', submittedAt: new Date() },
      });
      await tx.notification.create({
        data: {
          userId: change.approverUserId,
          projectId: change.projectId,
          type: 'CHANGE_APPROVAL_REQUIRED',
          title: `项目变更待审批：${change.code}`,
          content: change.title,
          resourceType: 'ProjectChangeRequest',
          resourceId: id,
        },
      });
      return updated;
    });
  }
  async approve(user: RequestUser, id: string, comment?: string) {
    return this.decide(user, id, true, comment);
  }
  async reject(user: RequestUser, id: string, comment?: string) {
    return this.decide(user, id, false, comment);
  }

  async apply(user: RequestUser, id: string) {
    const change = await this.get(user, id);
    await this.assertManager(user, change.projectId);
    if (change.status === 'APPLIED') return change;
    if (change.status !== 'APPROVED') throw this.invalidState(change.status);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await assertProjectWritable(tx, change.projectId);
          const claimed = await tx.projectChangeRequest.updateMany({
            where: { id, status: 'APPROVED' },
            data: { status: 'APPLYING' },
          });
          if (claimed.count !== 1) throw this.invalidState('APPLYING');
          for (const operation of change.operations)
            await this.applyOperation(
              tx,
              change.projectId,
              id,
              operation.operationType,
              operation.entityId,
              operation.payload,
            );
          await this.createBaseline(tx, change.projectId, user.id, id);
          await tx.projectChangeOperation.updateMany({
            where: { changeRequestId: id },
            data: { appliedAt: new Date() },
          });
          await tx.projectChangeRequest.update({
            where: { id },
            data: { status: 'APPLIED', appliedAt: new Date(), failureReason: null },
          });
          await tx.notification.createMany({
            data: [...new Set([change.requestedByUserId, change.approverUserId])].map((userId) => ({
              userId,
              projectId: change.projectId,
              type: 'CHANGE_APPLIED' as const,
              title: `项目变更已应用：${change.code}`,
              content: change.title,
              resourceType: 'ProjectChangeRequest',
              resourceId: id,
            })),
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      await this.prisma.projectChangeRequest.updateMany({
        where: { id, status: { not: 'APPLIED' } },
        data: {
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
    return this.get(user, id);
  }

  private async decide(user: RequestUser, id: string, approve: boolean, comment?: string) {
    const change = await this.get(user, id);
    if (!user.isAdministrator && change.approverUserId !== user.id)
      throw new ForbiddenException({
        code: 'PROJECT_CHANGE_APPROVER_MISMATCH',
        message: '只有本项目审批负责人可以审批',
      });
    if (change.status !== 'PENDING_APPROVAL') throw this.invalidState(change.status);
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, change.projectId);
      const updated = await tx.projectChangeRequest.update({
        where: { id },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          approvalComment: comment,
          ...(approve ? { approvedAt: new Date() } : { rejectedAt: new Date() }),
        },
      });
      await tx.notification.create({
        data: {
          userId: change.requestedByUserId,
          projectId: change.projectId,
          type: approve ? 'CHANGE_APPROVED' : 'CHANGE_REJECTED',
          title: approve ? `项目变更已批准：${change.code}` : `项目变更已驳回：${change.code}`,
          content: comment ?? change.title,
          resourceType: 'ProjectChangeRequest',
          resourceId: id,
        },
      });
      return updated;
    });
  }

  private async applyOperation(
    tx: Prisma.TransactionClient,
    projectId: string,
    changeId: string,
    type: string,
    entityId: string | null,
    raw: Prisma.JsonValue,
  ) {
    if (type === 'PROJECT_COMPLETION_DATE_CHANGE') {
      const payload = projectDatePayload.parse(raw);
      await tx.project.update({
        where: { id: projectId },
        data: { plannedGoLiveDate: payload.plannedCompletionDate },
      });
      return;
    }
    if (type === 'ADD_STAGE') {
      const payload = stagePayload.parse(raw);
      const plan = await tx.projectPlan.findUniqueOrThrow({ where: { projectId } });
      const aggregate = await tx.projectStage.aggregate({
        where: { planId: plan.id },
        _max: { sortOrder: true },
      });
      await tx.projectStage.create({
        data: {
          planId: plan.id,
          name: payload.name,
          description: payload.description,
          sortOrder: payload.sortOrder ?? (aggregate._max.sortOrder ?? -1) + 1,
          plannedStartDate: payload.plannedStartDate,
          plannedEndDate: payload.plannedEndDate,
          isCustom: true,
        },
      });
      return;
    }
    if (type === 'UPDATE_STAGE') {
      const id = this.requireEntityId(entityId);
      await this.requireStage(tx, projectId, id);
      const payload = stagePayload.partial().parse(raw);
      await tx.projectStage.update({ where: { id }, data: payload });
      return;
    }
    if (type === 'CANCEL_STAGE') {
      const id = this.requireEntityId(entityId);
      await this.requireStage(tx, projectId, id);
      await tx.projectWorkItem.updateMany({
        where: { projectId, planStageId: id },
        data: { status: 'CANCELLED', cancelledByChangeRequestId: changeId },
      });
      return;
    }
    if (type === 'ADD_WORK_ITEM') {
      const payload = workItemPayload.parse(raw);
      await this.requireStage(tx, projectId, payload.planStageId);
      if (payload.parentWorkItemId) {
        const parent = await this.requireWorkItem(tx, projectId, payload.parentWorkItemId);
        if (parent.planStageId !== payload.planStageId) throw this.scopeMismatch();
      }
      if (payload.ownerUserId) await this.requireProjectMember(tx, projectId, payload.ownerUserId);
      const aggregate = await tx.projectWorkItem.aggregate({
        where: { planStageId: payload.planStageId },
        _max: { sortOrder: true },
      });
      await tx.projectWorkItem.create({
        data: {
          projectId,
          planStageId: payload.planStageId,
          parentWorkItemId: payload.parentWorkItemId,
          name: payload.name,
          description: payload.description,
          ownerUserId: payload.ownerUserId,
          plannedStartDate: payload.plannedStartDate,
          plannedEndDate: payload.plannedEndDate,
          required: payload.required,
          sourceType: 'CHANGE',
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          isCustom: true,
          createdById: (
            await tx.projectChangeRequest.findUniqueOrThrow({ where: { id: changeId } })
          ).requestedByUserId,
        },
      });
      return;
    }
    if (type === 'UPDATE_WORK_ITEM') {
      const id = this.requireEntityId(entityId);
      await this.requireWorkItem(tx, projectId, id);
      const payload = updateWorkItemPayload.parse(raw);
      if (payload.ownerUserId) await this.requireProjectMember(tx, projectId, payload.ownerUserId);
      await tx.projectWorkItem.update({ where: { id }, data: payload });
      return;
    }
    if (type === 'CANCEL_WORK_ITEM') {
      const id = this.requireEntityId(entityId);
      await this.requireWorkItem(tx, projectId, id);
      await tx.projectWorkItem.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledByChangeRequestId: changeId },
      });
      return;
    }
    if (type === 'ADD_CHECKLIST') {
      const payload = checklistPayload.parse(raw);
      await this.requireWorkItem(tx, projectId, payload.workItemId);
      const aggregate = await tx.projectChecklistItem.aggregate({
        where: { workItemId: payload.workItemId },
        _max: { sortOrder: true },
      });
      await tx.projectChecklistItem.create({
        data: {
          workItemId: payload.workItemId,
          name: payload.name,
          required: payload.required,
          sortOrder: payload.sortOrder ?? (aggregate._max.sortOrder ?? -1) + 1,
          isCustom: true,
        },
      });
      return;
    }
    if (type === 'UPDATE_CHECKLIST') {
      const id = this.requireEntityId(entityId);
      await this.requireChecklist(tx, projectId, id);
      await tx.projectChecklistItem.update({
        where: { id },
        data: checklistPayload.omit({ workItemId: true }).partial().parse(raw),
      });
      return;
    }
    if (type === 'CANCEL_CHECKLIST') {
      const id = this.requireEntityId(entityId);
      await this.requireChecklist(tx, projectId, id);
      await tx.projectChecklistItem.update({
        where: { id },
        data: { required: false, isCustom: true },
      });
      return;
    }
    if (type === 'ADD_DELIVERABLE') {
      const payload = deliverablePayload.parse(raw);
      await this.requireWorkItem(tx, projectId, payload.workItemId);
      const aggregate = await tx.projectDeliverable.aggregate({
        where: { workItemId: payload.workItemId },
        _max: { sortOrder: true },
      });
      await tx.projectDeliverable.create({
        data: {
          ...payload,
          sortOrder: payload.sortOrder ?? (aggregate._max.sortOrder ?? -1) + 1,
          isCustom: true,
        },
      });
      return;
    }
    if (type === 'UPDATE_DELIVERABLE') {
      const id = this.requireEntityId(entityId);
      await this.requireDeliverable(tx, projectId, id);
      await tx.projectDeliverable.update({
        where: { id },
        data: deliverablePayload.omit({ workItemId: true }).partial().parse(raw),
      });
      return;
    }
    if (type === 'CANCEL_DELIVERABLE') {
      const id = this.requireEntityId(entityId);
      await this.requireDeliverable(tx, projectId, id);
      await tx.projectDeliverable.update({
        where: { id },
        data: { required: false, isCustom: true },
      });
      return;
    }
    if (type === 'DELIVERABLE_NEEDS_REVISION' || type === 'CHANGE_ACCEPTANCE_CRITERIA') {
      const id = this.requireEntityId(entityId);
      await this.requireDeliverable(tx, projectId, id);
      const payload = revisionPayload.parse(raw);
      await tx.projectDeliverable.update({
        where: { id },
        data: { needsRevision: true, revisionReason: `${changeId}: ${payload.reason}` },
      });
      return;
    }
    if (type === 'CHANGE_OWNER') {
      const id = this.requireEntityId(entityId);
      await this.requireWorkItem(tx, projectId, id);
      const payload = ownerPayload.parse(raw);
      await this.requireProjectMember(tx, projectId, payload.ownerUserId);
      await tx.projectWorkItem.update({ where: { id }, data: payload });
      return;
    }
    throw new BadRequestException({
      code: 'PROJECT_CHANGE_OPERATION_UNSUPPORTED',
      message: `不支持的变更操作：${type}`,
    });
  }

  private requireEntityId(entityId: string | null) {
    if (!entityId)
      throw new BadRequestException({
        code: 'PROJECT_CHANGE_ENTITY_REQUIRED',
        message: '变更操作缺少目标实体',
      });
    return entityId;
  }

  private async requireStage(tx: Prisma.TransactionClient, projectId: string, id: string) {
    const stage = await tx.projectStage.findFirst({ where: { id, plan: { projectId } } });
    if (!stage) throw this.scopeMismatch();
    return stage;
  }

  private async requireWorkItem(tx: Prisma.TransactionClient, projectId: string, id: string) {
    const workItem = await tx.projectWorkItem.findFirst({ where: { id, projectId } });
    if (!workItem) throw this.scopeMismatch();
    return workItem;
  }

  private async requireChecklist(tx: Prisma.TransactionClient, projectId: string, id: string) {
    const checklist = await tx.projectChecklistItem.findFirst({
      where: { id, workItem: { projectId } },
    });
    if (!checklist) throw this.scopeMismatch();
    return checklist;
  }

  private async requireDeliverable(tx: Prisma.TransactionClient, projectId: string, id: string) {
    const deliverable = await tx.projectDeliverable.findFirst({
      where: { id, workItem: { projectId } },
    });
    if (!deliverable) throw this.scopeMismatch();
    return deliverable;
  }

  private async requireProjectMember(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
  ) {
    const member = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { user: { select: { status: true, deletedAt: true } } },
    });
    if (!member || member.user.status !== 'ACTIVE' || member.user.deletedAt)
      throw new BadRequestException({
        code: 'PROJECT_CHANGE_OWNER_INVALID',
        message: '负责人必须是当前项目的有效成员',
      });
  }

  private scopeMismatch() {
    return new BadRequestException({
      code: 'PROJECT_CHANGE_ENTITY_SCOPE_MISMATCH',
      message: '变更目标不属于当前项目',
    });
  }

  private validateOperation(type: string, payload: object) {
    const map: Record<string, z.ZodTypeAny> = {
      PROJECT_COMPLETION_DATE_CHANGE: projectDatePayload,
      ADD_STAGE: stagePayload,
      UPDATE_STAGE: stagePayload.partial(),
      ADD_WORK_ITEM: workItemPayload,
      UPDATE_WORK_ITEM: updateWorkItemPayload,
      ADD_CHECKLIST: checklistPayload,
      UPDATE_CHECKLIST: checklistPayload.omit({ workItemId: true }).partial(),
      ADD_DELIVERABLE: deliverablePayload,
      UPDATE_DELIVERABLE: deliverablePayload.omit({ workItemId: true }).partial(),
      DELIVERABLE_NEEDS_REVISION: revisionPayload,
      CHANGE_ACCEPTANCE_CRITERIA: revisionPayload,
      CHANGE_OWNER: ownerPayload,
      CANCEL_STAGE: z.object({}).passthrough(),
      CANCEL_WORK_ITEM: z.object({}).passthrough(),
      CANCEL_CHECKLIST: z.object({}).passthrough(),
      CANCEL_DELIVERABLE: z.object({}).passthrough(),
    };
    const result = map[type]?.safeParse(payload);
    if (!result?.success)
      throw new BadRequestException({
        code: 'PROJECT_CHANGE_OPERATION_INVALID',
        message: `变更操作参数无效：${type}`,
        details: result?.error.issues,
      });
  }

  private async createBaseline(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
    sourceChangeRequestId?: string,
  ) {
    const [project, plan] = await Promise.all([
      tx.project.findUnique({ where: { id: projectId } }),
      tx.projectPlan.findUnique({
        where: { projectId },
        include: {
          stages: {
            orderBy: { sortOrder: 'asc' },
            include: {
              workItems: {
                where: { status: { not: 'CANCELLED' } },
                orderBy: { sortOrder: 'asc' },
                include: {
                  checklistItems: { orderBy: { sortOrder: 'asc' } },
                  deliverables: { orderBy: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
      }),
    ]);
    if (!project?.plannedStartDate || !project.plannedGoLiveDate || !plan)
      throw new ConflictException({
        code: 'PROJECT_BASELINE_REQUIRED',
        message: '项目缺少有效计划日期或执行计划',
      });
    const latest = await tx.projectBaseline.aggregate({
      where: { projectId },
      _max: { version: true },
    });
    return tx.projectBaseline.create({
      data: {
        projectId,
        version: (latest._max.version ?? 0) + 1,
        plannedStartDate: project.plannedStartDate,
        plannedCompletionDate: project.plannedGoLiveDate,
        createdByUserId: userId,
        sourceChangeRequestId,
        stages: {
          create: plan.stages.map((stage) => ({
            sourceStageId: stage.id,
            name: stage.name,
            sortOrder: stage.sortOrder,
            weight: stage.weight,
            plannedStartDate: stage.plannedStartDate,
            plannedEndDate: stage.plannedEndDate,
            workItems: {
              create: stage.workItems.map((item) => ({
                sourceWorkItemId: item.id,
                name: item.name,
                required: item.required,
                sortOrder: item.sortOrder,
                weight: item.weight,
                plannedStartDate: item.plannedStartDate,
                plannedEndDate: item.plannedEndDate,
                checklistItems: {
                  create: item.checklistItems.map((check) => ({
                    sourceChecklistItemId: check.id,
                    name: check.name,
                    required: check.required,
                    sortOrder: check.sortOrder,
                  })),
                },
                deliverables: {
                  create: item.deliverables.map((deliverable) => ({
                    sourceDeliverableId: deliverable.id,
                    name: deliverable.name,
                    description: deliverable.description,
                    required: deliverable.required,
                    sortOrder: deliverable.sortOrder,
                    reviewMode: deliverable.reviewMode,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  }
  private async latestBaseline(projectId: string) {
    const baseline = await this.prisma.projectBaseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (!baseline || baseline.plannedCompletionDate <= baseline.plannedStartDate)
      throw new ConflictException({
        code: 'PROJECT_BASELINE_REQUIRED',
        message: '项目没有有效批准基线',
      });
    return baseline;
  }
  private async assertManager(user: RequestUser, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '项目不存在' });
    if (!user.isAdministrator && project.managerUserId !== user.id)
      throw new ForbiddenException({
        code: 'PROJECT_CHANGE_MANAGER_REQUIRED',
        message: '只有项目经理可以提出或应用正式变更',
      });
    return project;
  }
  private invalidState(status: string) {
    return new ConflictException({
      code: 'PROJECT_CHANGE_INVALID_STATE',
      message: '项目变更状态不允许此操作',
      details: { status },
    });
  }
  private notFound() {
    return new NotFoundException({ code: 'PROJECT_CHANGE_NOT_FOUND', message: '项目变更不存在' });
  }
}

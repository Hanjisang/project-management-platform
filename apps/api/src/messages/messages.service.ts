import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type MessageAnalysis,
  type MessageSource,
  type PendingAction,
} from '@prisma/client';
import { calculateRiskScore } from '@pmp/shared-utils';
import { z } from 'zod';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { AI_PROVIDER, type AiProvider } from '../integrations/ai/ai.provider';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../project-plans/progress.service';
import { assertProjectWritable } from '../projects/project-mutation';
import type { ConfirmMessageDto, CreateManualMessageDto, MessageListQueryDto } from './dto';

const taskPayload = z.object({
  title: z.string().min(1).max(240),
  description: z.string().max(10000).default(''),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().date().nullable().default(null),
});
const issuePayload = z.object({
  type: z.enum(['ISSUE', 'RISK', 'CHANGE', 'BLOCKER']),
  title: z.string().min(1).max(240),
  description: z.string().max(10000).default(''),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
});
const progressPayload = z.object({
  workItemId: z.string(),
  progress: z.number().int().min(0).max(100),
  evidence: z.string().max(2000),
});
const notePayload = z.object({ content: z.string().min(1).max(5000) });

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly progress: ProgressService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}
  status() {
    return this.ai.status();
  }
  async list(user: RequestUser, query: MessageListQueryDto) {
    if (query.projectId) await this.scope.assert(user, query.projectId);
    const where: Prisma.MessageWhereInput = {
      ...(user.isAdministrator ? {} : { project: { members: { some: { userId: user.id } } } }),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { content: { contains: query.search } },
              { senderName: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        include: {
          project: { select: { id: true, code: true, name: true } },
          analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
          pendingActions: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { receivedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.message.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }
  async createManual(user: RequestUser, dto: CreateManualMessageDto) {
    if (dto.projectId) await this.scope.assert(user, dto.projectId);
    else if (!user.isAdministrator)
      throw new ForbiddenException({
        code: 'UNASSIGNED_MESSAGE_ADMIN_ONLY',
        message: '只有管理员可创建未归属消息',
      });
    return this.prisma.message.create({
      data: {
        source: 'MANUAL',
        projectId: dto.projectId,
        senderName: dto.senderName.trim(),
        content: dto.content.trim(),
        receivedAt: dto.receivedAt ?? new Date(),
        createdById: user.id,
      },
    });
  }
  async ingestExternal(input: {
    source: MessageSource;
    externalMessageId: string;
    projectId?: string;
    senderName: string;
    senderExternalId?: string;
    content: string;
    receivedAt: Date;
    rawPayload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.message.upsert({
      where: { externalMessageId: input.externalMessageId },
      create: input,
      update: {},
    });
  }
  async analyze(user: RequestUser, messageId: string) {
    const message = await this.getScoped(user, messageId);
    const claimed = await this.claimAnalysis(messageId);
    if (!claimed.execute) return claimed.analysis;
    const analysis = claimed.analysis;
    try {
      const result = await this.ai.analyze(
        message.content,
        message.project ? { id: message.project.id, name: message.project.name } : undefined,
      );
      const targetProjectId = message.projectId ?? result.project.id;
      if (targetProjectId) await this.scope.assert(user, targetProjectId);
      const actions = targetProjectId
        ? this.toActions(targetProjectId, messageId, analysis.id, result)
        : [];
      await this.prisma.$transaction(async (tx) => {
        await tx.messageAnalysis.update({
          where: { id: analysis.id },
          data: { status: 'SUCCEEDED', result, completedAt: new Date() },
        });
        if (actions.length) await tx.pendingAction.createMany({ data: actions });
        await tx.message.update({
          where: { id: messageId },
          data: {
            status: actions.length ? 'PENDING_CONFIRMATION' : 'ANALYZED',
            projectId: message.projectId ?? targetProjectId,
          },
        });
      });
      return this.prisma.messageAnalysis.findUnique({
        where: { id: analysis.id },
        include: { actions: true },
      });
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.messageAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: 'FAILED',
            errorCode: this.errorCode(error),
            errorMessage: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          },
        }),
        this.prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED' } }),
      ]);
      throw error;
    }
  }
  async confirm(user: RequestUser, messageId: string, dto: ConfirmMessageDto) {
    await this.getScoped(user, messageId);
    const duplicate =
      dto.decisions.length !== new Set(dto.decisions.map((item) => item.actionId)).size;
    if (duplicate)
      throw new BadRequestException({
        code: 'PENDING_ACTION_DUPLICATE',
        message: '确认列表包含重复操作',
      });
    const projectIds = new Set<string>();
    for (const decision of dto.decisions) {
      const action = await this.prisma.pendingAction.findUnique({
        where: { id: decision.actionId },
      });
      if (!action || action.messageId !== messageId)
        throw new BadRequestException({
          code: 'PENDING_ACTION_INVALID',
          message: '待确认操作不属于该消息',
        });
      await this.scope.assert(user, action.projectId);
      projectIds.add(action.projectId);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            for (const projectId of projectIds) await assertProjectWritable(tx, projectId);
            for (const decision of dto.decisions) {
              const action = await tx.pendingAction.findUniqueOrThrow({
                where: { id: decision.actionId },
              });
              if (action.status !== 'PENDING') continue;
              if (decision.decision === 'REJECT') {
                await tx.pendingAction.update({
                  where: { id: action.id },
                  data: { status: 'REJECTED', confirmedById: user.id, confirmedAt: new Date() },
                });
                continue;
              }
              const claim = await tx.pendingAction.updateMany({
                where: { id: action.id, status: 'PENDING' },
                data: { status: 'CONFIRMED', confirmedById: user.id, confirmedAt: new Date() },
              });
              if (claim.count === 0) continue;
              const payload = {
                ...(action.payload as Record<string, unknown>),
                ...(decision.payload ?? {}),
              };
              const result = await this.executeAction(
                tx,
                action.type,
                action.projectId,
                messageId,
                user.id,
                payload,
              );
              await tx.pendingAction.update({
                where: { id: action.id },
                data: {
                  payload: payload as Prisma.InputJsonValue,
                  resultResourceType: result.type,
                  resultResourceId: result.id,
                },
              });
            }
            const remaining = await tx.pendingAction.count({
              where: { messageId, status: 'PENDING' },
            });
            await tx.message.update({
              where: { id: messageId },
              data: { status: remaining === 0 ? 'CONFIRMED' : 'PENDING_CONFIRMATION' },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (attempt === 2 || !this.isTransactionConflict(error)) throw error;
      }
    }
    return this.prisma.message.findUnique({
      where: { id: messageId },
      include: { pendingActions: true, analyses: true },
    });
  }
  private async executeAction(
    tx: Prisma.TransactionClient,
    type: string,
    projectId: string,
    messageId: string,
    userId: string,
    raw: Record<string, unknown>,
  ): Promise<{ type: string; id: string }> {
    if (type === 'CREATE_TASK') {
      const payload = taskPayload.parse(raw);
      const plan = await tx.projectPlan.findUnique({ where: { projectId } });
      if (!plan)
        throw new BadRequestException({
          code: 'PROJECT_PLAN_REQUIRED',
          message: '项目尚未生成执行计划',
        });
      let stage = await tx.projectStage.findFirst({
        where: { planId: plan.id, isCustom: true, name: '临时任务' },
      });
      if (!stage) {
        const aggregate = await tx.projectStage.aggregate({
          where: { planId: plan.id },
          _max: { sortOrder: true },
        });
        stage = await tx.projectStage.create({
          data: {
            planId: plan.id,
            name: '临时任务',
            sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
            isCustom: true,
          },
        });
      }
      const aggregate = await tx.projectWorkItem.aggregate({
        where: { planStageId: stage.id },
        _max: { sortOrder: true },
      });
      const item = await tx.projectWorkItem.create({
        data: {
          projectId,
          planStageId: stage.id,
          name: payload.title,
          description: payload.description,
          priority: payload.priority,
          plannedEndDate: payload.dueDate ? new Date(payload.dueDate) : null,
          sourceType: 'MANUAL',
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          isCustom: true,
          required: false,
          createdById: userId,
        },
      });
      return { type: 'ProjectWorkItem', id: item.id };
    }
    if (type === 'CREATE_ISSUE' || type === 'CREATE_RISK') {
      const payload = issuePayload.parse(raw);
      const riskScore =
        payload.probability && payload.impact
          ? calculateRiskScore(payload.probability, payload.impact)
          : null;
      const item = await tx.issue.create({
        data: {
          projectId,
          type: type === 'CREATE_RISK' ? 'RISK' : payload.type,
          title: payload.title,
          description: payload.description,
          severity: payload.severity,
          probability: payload.probability,
          impact: payload.impact,
          riskScore,
          sourceType: 'MESSAGE',
          sourceId: messageId,
          createdById: userId,
        },
      });
      return { type: 'Issue', id: item.id };
    }
    if (type === 'UPDATE_PROGRESS') {
      const payload = progressPayload.parse(raw);
      const task = await tx.projectWorkItem.findFirst({
        where: { id: payload.workItemId, projectId },
      });
      if (!task)
        throw new BadRequestException({
          code: 'PLAN_TASK_INVALID',
          message: '进度目标节点不属于该项目',
        });
      await tx.projectWorkItem.update({
        where: { id: task.id },
        data: {
          progress: payload.progress,
          actualStartDate:
            payload.progress > 0 ? (task.actualStartDate ?? new Date()) : task.actualStartDate,
          actualEndDate: payload.progress === 100 ? new Date() : null,
        },
      });
      await this.progress.recomputeStage(task.planStageId, tx);
      return { type: 'ProjectWorkItem', id: task.id };
    }
    const payload = notePayload.parse(raw);
    const item = await tx.projectNote.create({
      data: {
        projectId,
        content: payload.content,
        sourceMessageId: messageId,
        createdById: userId,
      },
    });
    return { type: 'ProjectNote', id: item.id };
  }
  private toActions(
    projectId: string,
    messageId: string,
    analysisId: string,
    result: Awaited<ReturnType<AiProvider['analyze']>>,
  ): Prisma.PendingActionCreateManyInput[] {
    return [
      ...result.tasks.map((payload) => ({
        projectId,
        messageId,
        analysisId,
        type: 'CREATE_TASK' as const,
        payload,
      })),
      ...result.issues.map((payload) => ({
        projectId,
        messageId,
        analysisId,
        type: 'CREATE_ISSUE' as const,
        payload: { ...payload, type: 'ISSUE' },
      })),
      ...result.risks.map((payload) => ({
        projectId,
        messageId,
        analysisId,
        type: 'CREATE_RISK' as const,
        payload: { ...payload, type: 'RISK' },
      })),
      ...result.progressUpdates.map((payload) => ({
        projectId,
        messageId,
        analysisId,
        type: 'UPDATE_PROGRESS' as const,
        payload,
      })),
      ...result.decisions.map((payload) => ({
        projectId,
        messageId,
        analysisId,
        type: 'CREATE_NOTE' as const,
        payload,
      })),
      ...result.followUps.map((payload) => ({
        projectId,
        messageId,
        analysisId,
        type: 'CREATE_NOTE' as const,
        payload: {
          content: payload.dueDate
            ? `${payload.content}\n截止日期：${payload.dueDate}`
            : payload.content,
        },
      })),
    ];
  }
  private async getScoped(user: RequestUser, id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!message) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND', message: '消息不存在' });
    if (message.projectId) await this.scope.assert(user, message.projectId);
    else if (!user.isAdministrator)
      throw new ForbiddenException({
        code: 'UNASSIGNED_MESSAGE_ADMIN_ONLY',
        message: '无权访问未归属消息',
      });
    return message;
  }
  private errorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { code?: string } }).response;
      if (response?.code) return response.code;
    }
    return 'AI_ANALYSIS_FAILED';
  }

  private async claimAnalysis(messageId: string): Promise<{
    analysis: MessageAnalysis & { actions?: PendingAction[] };
    execute: boolean;
  }> {
    try {
      const analysis = await this.prisma.messageAnalysis.create({
        data: {
          messageId,
          provider: this.ai.status().provider,
          model: this.ai.status().model,
          status: 'PENDING',
        },
      });
      return { analysis, execute: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
    }
    const existing = await this.prisma.messageAnalysis.findUniqueOrThrow({
      where: { messageId },
      include: { actions: true },
    });
    if (existing.status === 'SUCCEEDED') return { analysis: existing, execute: false };
    if (existing.status === 'PENDING')
      throw new ConflictException({
        code: 'MESSAGE_ANALYSIS_IN_PROGRESS',
        message: '消息正在分析，请勿重复提交',
      });
    const claim = await this.prisma.messageAnalysis.updateMany({
      where: { id: existing.id, status: 'FAILED' },
      data: {
        status: 'PENDING',
        errorCode: null,
        errorMessage: null,
        completedAt: null,
        provider: this.ai.status().provider,
        model: this.ai.status().model,
      },
    });
    if (claim.count !== 1)
      throw new ConflictException({
        code: 'MESSAGE_ANALYSIS_IN_PROGRESS',
        message: '消息正在分析，请勿重复提交',
      });
    return {
      analysis: await this.prisma.messageAnalysis.findUniqueOrThrow({ where: { id: existing.id } }),
      execute: true,
    };
  }

  private isTransactionConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && ['P2034'].includes(error.code);
  }
}

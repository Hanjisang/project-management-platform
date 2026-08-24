import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { stableJson } from '@pmp/shared-utils';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectWritable } from '../projects/project-mutation';
import type { CompleteChecklistDto, GeneratePlanDto, SyncPlanDto, UpdatePlanTaskDto } from './dto';
import { buildPlanDiff } from './plan-diff';
import { ProgressService } from './progress.service';

type PlanTree = Prisma.ProjectPlanGetPayload<{
  include: {
    stages: {
      include: {
        tasks: {
          include: { checklistItems: true; _count: { select: { tasks: true; documents: true } } };
        };
      };
    };
  };
}>;
type VersionTree = Prisma.SopVersionGetPayload<{
  include: {
    template: true;
    stages: { include: { tasks: { include: { checklistItems: true } } } };
  };
}>;

@Injectable()
export class ProjectPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly progress: ProgressService,
  ) {}

  async get(user: RequestUser, projectId: string) {
    await this.scope.assert(user, projectId);
    const plan = await this.loadPlan(projectId);
    if (!plan) throw this.notFound();
    return plan;
  }

  async generate(user: RequestUser, projectId: string, dto: GeneratePlanDto) {
    await this.scope.assert(user, projectId);
    const [project, version, existing] = await Promise.all([
      this.prisma.project.findFirst({ where: { id: projectId, deletedAt: null } }),
      this.loadVersion(dto.sopVersionId),
      this.prisma.projectPlan.findUnique({ where: { projectId } }),
    ]);
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '项目不存在' });
    if (!version || version.status !== 'PUBLISHED')
      throw new BadRequestException({
        code: 'SOP_VERSION_NOT_PUBLISHED',
        message: '只能使用已发布的 SOP 版本',
      });
    if (existing)
      throw new ConflictException({
        code: 'PROJECT_PLAN_EXISTS',
        message: '项目已有实施计划，请使用同步功能',
      });
    let cursor = project.plannedStartDate ?? new Date();
    const stageCreates = version.stages.map((stage) => {
      const stageStart = cursor;
      const stageEnd = this.addDays(stageStart, Math.max(1, stage.defaultDurationDays) - 1);
      let taskCursor = stageStart;
      const tasks = stage.tasks.map((task) => {
        const taskStart = taskCursor;
        const taskEnd = this.addDays(taskStart, Math.max(1, task.defaultDurationDays) - 1);
        taskCursor = this.addDays(taskEnd, 1);
        return {
          sourceTaskId: task.id,
          sourceTaskKey: task.stableKey,
          name: task.name,
          description: task.description,
          sortOrder: task.sortOrder,
          weight: task.weight,
          required: task.required,
          deliverableRequired: task.deliverableRequired,
          deliverableName: task.deliverableName,
          plannedStartDate: taskStart,
          plannedEndDate: taskEnd,
          checklistItems: {
            create: task.checklistItems.map((item) => ({
              sourceItemId: item.id,
              sourceItemKey: item.stableKey,
              name: item.name,
              sortOrder: item.sortOrder,
              required: item.required,
            })),
          },
        };
      });
      cursor = this.addDays(stageEnd, 1);
      return {
        sourceStageId: stage.id,
        sourceStageKey: stage.stableKey,
        name: stage.name,
        description: stage.description,
        sortOrder: stage.sortOrder,
        weight: stage.weight,
        plannedStartDate: stageStart,
        plannedEndDate: stageEnd,
        tasks: { create: tasks },
      };
    });
    await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      await tx.projectPlan.create({
        data: {
          projectId,
          sourceSopVersionId: version.id,
          name: `${version.template.name} ${version.version}`,
          stages: { create: stageCreates },
        },
      });
    });
    return this.get(user, projectId);
  }

  async updateTask(user: RequestUser, id: string, dto: UpdatePlanTaskDto) {
    const task = await this.prisma.projectPlanTask.findUnique({
      where: { id },
      include: { stage: { include: { plan: true } } },
    });
    if (!task)
      throw new NotFoundException({ code: 'PLAN_TASK_NOT_FOUND', message: '计划节点不存在' });
    await this.scope.assert(user, task.stage.plan.projectId);
    const start = dto.plannedStartDate ?? task.plannedStartDate;
    const end = dto.plannedEndDate ?? task.plannedEndDate;
    if (start && end && start > end)
      throw new BadRequestException({
        code: 'PLAN_TASK_DATE_INVALID',
        message: '计划开始日期不能晚于结束日期',
      });
    if (dto.ownerUserId) {
      const membership = await this.prisma.projectMember.count({
        where: { projectId: task.stage.plan.projectId, userId: dto.ownerUserId },
      });
      if (!membership)
        throw new BadRequestException({
          code: 'PLAN_TASK_OWNER_INVALID',
          message: '负责人必须是项目成员',
        });
    }
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, task.stage.plan.projectId);
      return tx.projectPlanTask.update({ where: { id }, data: dto });
    });
  }

  async completeChecklist(user: RequestUser, id: string, dto: CompleteChecklistDto) {
    const item = await this.prisma.projectChecklistItem.findUnique({
      where: { id },
      include: { task: { include: { stage: { include: { plan: true } } } } },
    });
    if (!item)
      throw new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: '检查项不存在' });
    await this.scope.assert(user, item.task.stage.plan.projectId);
    await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, item.task.stage.plan.projectId);
      await tx.projectChecklistItem.update({
        where: { id },
        data: {
          completed: dto.completed,
          completedAt: dto.completed ? new Date() : null,
          completedById: dto.completed ? user.id : null,
        },
      });
      await this.progress.recomputeFromChecklist(item.planTaskId, tx);
    });
    return this.prisma.projectChecklistItem.findUnique({ where: { id } });
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
    const diff = buildPlanDiff(plan.stages, version.stages);
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
    const plan = await this.loadPlan(projectId);
    const version = await this.loadVersion(dto.sopVersionId);
    if (!plan || !version) throw this.notFound();
    await this.applySync(plan, version);
    await this.progress.recomputePlan(plan.id);
    return { ...(await this.get(user, projectId)), appliedDiff: preview.diff };
  }

  private async applySync(plan: PlanTree, version: VersionTree): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, plan.projectId);
      for (const [index, stage] of plan.stages.entries()) {
        await tx.projectPlanStage.update({
          where: { id: stage.id },
          data: { sortOrder: 10_000 + index },
        });
        for (const [taskIndex, task] of stage.tasks.entries()) {
          await tx.projectPlanTask.update({
            where: { id: task.id },
            data: { sortOrder: 10_000 + taskIndex },
          });
          for (const [itemIndex, item] of task.checklistItems.entries())
            await tx.projectChecklistItem.update({
              where: { id: item.id },
              data: { sortOrder: 10_000 + itemIndex },
            });
        }
      }
      const oldStages = new Map(
        plan.stages
          .filter((stage) => stage.sourceStageKey)
          .map((stage) => [stage.sourceStageKey!, stage]),
      );
      const oldTasks = new Map(
        plan.stages
          .flatMap((stage) => stage.tasks)
          .filter((task) => task.sourceTaskKey)
          .map((task) => [task.sourceTaskKey!, task]),
      );
      const targetStageKeys = new Set(version.stages.map((stage) => stage.stableKey));
      const targetTaskKeys = new Set(
        version.stages.flatMap((stage) => stage.tasks.map((task) => task.stableKey)),
      );
      const targetItemKeys = new Set(
        version.stages.flatMap((stage) =>
          stage.tasks.flatMap((task) => task.checklistItems.map((item) => item.stableKey)),
        ),
      );

      for (const targetStage of version.stages) {
        const oldStage = oldStages.get(targetStage.stableKey);
        const stage = oldStage
          ? await tx.projectPlanStage.update({
              where: { id: oldStage.id },
              data: {
                sourceStageId: targetStage.id,
                sourceStageKey: targetStage.stableKey,
                name: targetStage.name,
                description: targetStage.description,
                sortOrder: targetStage.sortOrder,
                weight: targetStage.weight,
              },
            })
          : await tx.projectPlanStage.create({
              data: {
                planId: plan.id,
                sourceStageId: targetStage.id,
                sourceStageKey: targetStage.stableKey,
                name: targetStage.name,
                description: targetStage.description,
                sortOrder: targetStage.sortOrder,
                weight: targetStage.weight,
              },
            });
        for (const targetTask of targetStage.tasks) {
          const oldTask = oldTasks.get(targetTask.stableKey);
          const task = oldTask
            ? await tx.projectPlanTask.update({
                where: { id: oldTask.id },
                data: {
                  planStageId: stage.id,
                  sourceTaskId: targetTask.id,
                  sourceTaskKey: targetTask.stableKey,
                  name: targetTask.name,
                  description: targetTask.description,
                  sortOrder: targetTask.sortOrder,
                  weight: targetTask.weight,
                  required: targetTask.required,
                  deliverableRequired: targetTask.deliverableRequired,
                  deliverableName: targetTask.deliverableName,
                },
              })
            : await tx.projectPlanTask.create({
                data: {
                  planStageId: stage.id,
                  sourceTaskId: targetTask.id,
                  sourceTaskKey: targetTask.stableKey,
                  name: targetTask.name,
                  description: targetTask.description,
                  sortOrder: targetTask.sortOrder,
                  weight: targetTask.weight,
                  required: targetTask.required,
                  deliverableRequired: targetTask.deliverableRequired,
                  deliverableName: targetTask.deliverableName,
                },
              });
          const oldItems = new Map(
            (oldTask?.checklistItems ?? [])
              .filter((item) => item.sourceItemKey)
              .map((item) => [item.sourceItemKey!, item]),
          );
          for (const targetItem of targetTask.checklistItems) {
            const oldItem = oldItems.get(targetItem.stableKey);
            if (oldItem)
              await tx.projectChecklistItem.update({
                where: { id: oldItem.id },
                data: {
                  sourceItemId: targetItem.id,
                  sourceItemKey: targetItem.stableKey,
                  name: targetItem.name,
                  sortOrder: targetItem.sortOrder,
                  required: targetItem.required,
                },
              });
            else
              await tx.projectChecklistItem.create({
                data: {
                  planTaskId: task.id,
                  sourceItemId: targetItem.id,
                  sourceItemKey: targetItem.stableKey,
                  name: targetItem.name,
                  sortOrder: targetItem.sortOrder,
                  required: targetItem.required,
                },
              });
          }
        }
      }

      for (const stage of plan.stages)
        for (const task of stage.tasks)
          for (const item of task.checklistItems) {
            if (item.sourceItemKey && !targetItemKeys.has(item.sourceItemKey)) {
              if (item.completed || item.isCustom)
                await tx.projectChecklistItem.update({
                  where: { id: item.id },
                  data: { sourceItemId: null, sourceItemKey: null, isCustom: true },
                });
              else await tx.projectChecklistItem.delete({ where: { id: item.id } });
            }
          }
      for (const stage of plan.stages)
        for (const task of stage.tasks) {
          if (task.sourceTaskKey && !targetTaskKeys.has(task.sourceTaskKey)) {
            const preserve =
              task.progress > 0 ||
              Boolean(task.ownerUserId || task.actualStartDate || task.actualEndDate) ||
              task.isCustom ||
              task._count.tasks > 0 ||
              task._count.documents > 0;
            if (preserve)
              await tx.projectPlanTask.update({
                where: { id: task.id },
                data: { sourceTaskId: null, sourceTaskKey: null, isCustom: true },
              });
            else await tx.projectPlanTask.delete({ where: { id: task.id } });
          }
        }
      for (const stage of plan.stages) {
        if (stage.sourceStageKey && !targetStageKeys.has(stage.sourceStageKey)) {
          const remaining = await tx.projectPlanTask.count({ where: { planStageId: stage.id } });
          if (remaining > 0 || stage.progress > 0 || stage.isCustom)
            await tx.projectPlanStage.update({
              where: { id: stage.id },
              data: { sourceStageId: null, sourceStageKey: null, isCustom: true },
            });
          else await tx.projectPlanStage.delete({ where: { id: stage.id } });
        }
      }
      await tx.projectPlan.update({
        where: { id: plan.id },
        data: {
          sourceSopVersionId: version.id,
          syncedAt: new Date(),
          name: `${version.template.name} ${version.version}`,
        },
      });
      await this.reindexCustomNodes(tx, plan.id, version);
    });
  }

  private async reindexCustomNodes(
    tx: Prisma.TransactionClient,
    planId: string,
    version: VersionTree,
  ): Promise<void> {
    const stages = await tx.projectPlanStage.findMany({
      where: { planId },
      include: { tasks: { include: { checklistItems: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    let customStageOrder = version.stages.length;
    for (const stage of stages.filter((item) => item.isCustom))
      await tx.projectPlanStage.update({
        where: { id: stage.id },
        data: { sortOrder: customStageOrder++ },
      });
    for (const stage of stages) {
      const targetCount =
        version.stages.find((item) => item.stableKey === stage.sourceStageKey)?.tasks.length ?? 0;
      let customTaskOrder = targetCount;
      for (const task of stage.tasks.filter((item) => item.isCustom))
        await tx.projectPlanTask.update({
          where: { id: task.id },
          data: { sortOrder: customTaskOrder++ },
        });
      for (const task of stage.tasks) {
        const source = version.stages
          .flatMap((item) => item.tasks)
          .find((item) => item.stableKey === task.sourceTaskKey);
        let customItemOrder = source?.checklistItems.length ?? 0;
        for (const item of task.checklistItems.filter((entry) => entry.isCustom))
          await tx.projectChecklistItem.update({
            where: { id: item.id },
            data: { sortOrder: customItemOrder++ },
          });
      }
    }
  }

  private loadPlan(projectId: string) {
    return this.prisma.projectPlan.findUnique({
      where: { projectId },
      include: {
        sourceVersion: { include: { template: true } },
        stages: {
          include: {
            tasks: {
              include: {
                checklistItems: { orderBy: { sortOrder: 'asc' } },
                owner: { select: { id: true, displayName: true } },
                _count: { select: { tasks: true, documents: true } },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }
  private loadVersion(id: string) {
    return this.prisma.sopVersion.findUnique({
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
  }
  private hash(diff: unknown): string {
    return createHash('sha256').update(stableJson(diff)).digest('hex');
  }
  private addDays(date: Date, days: number): Date {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
  }
  private notFound() {
    return new NotFoundException({ code: 'PROJECT_PLAN_NOT_FOUND', message: '项目实施计划不存在' });
  }
}

import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectWritable } from '../projects/project-mutation';
import { ProgressService } from './progress.service';

@Injectable()
export class ExecutionIntegrityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  async assertProjectDateUpdateAllowed(
    projectId: string,
    input: { plannedStartDate?: Date; plannedGoLiveDate?: Date },
  ): Promise<void> {
    if (input.plannedStartDate === undefined && input.plannedGoLiveDate === undefined) return;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true, plannedStartDate: true, plannedGoLiveDate: true },
    });
    if (!project || !['ACTIVE', 'PAUSED'].includes(project.status)) return;
    const startChanged =
      input.plannedStartDate !== undefined &&
      input.plannedStartDate.getTime() !== project.plannedStartDate?.getTime();
    const completionChanged =
      input.plannedGoLiveDate !== undefined &&
      input.plannedGoLiveDate.getTime() !== project.plannedGoLiveDate?.getTime();
    if (startChanged || completionChanged)
      throw new ConflictException({
        code: 'PROJECT_CHANGE_APPROVAL_REQUIRED',
        message: '已启动项目的计划起止日期不能通过普通项目编辑修改，请使用计划调整或项目变更',
      });
  }

  async assertDirectWorkItemCreationAllowed(projectId: string, required: boolean): Promise<void> {
    if (!required) return;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    if (project && ['ACTIVE', 'PAUSED'].includes(project.status))
      throw new ConflictException({
        code: 'PROJECT_CHANGE_APPROVAL_REQUIRED',
        message: '已启动项目新增必需任务属于范围变更，请通过项目变更申请处理',
      });
  }

  async assertDirectWorkItemCancellationAllowed(workItemId: string): Promise<void> {
    const item = await this.prisma.projectWorkItem.findUnique({
      where: { id: workItemId },
      select: { required: true, project: { select: { status: true } } },
    });
    if (item?.required && ['ACTIVE', 'PAUSED'].includes(item.project.status))
      throw new ConflictException({
        code: 'PROJECT_CHANGE_APPROVAL_REQUIRED',
        message: '已启动项目取消必需任务属于范围变更，请通过项目变更申请处理',
      });
  }

  async assertSafeDirectSopSync(projectId: string): Promise<void> {
    const customCount = await this.prisma.projectWorkItem.count({
      where: {
        projectId,
        OR: [{ sourceType: { not: 'SOP' } }, { isCustom: true }],
      },
    });
    if (customCount > 0)
      throw new ConflictException({
        code: 'SOP_SYNC_CUSTOM_WORK_ITEMS_PRESENT',
        message: '项目存在人工或变更新增任务，禁止通过重建计划同步 SOP，以免丢失项目自定义执行数据',
        details: { customWorkItemCount: customCount },
      });
  }

  async ensureManualStage(projectId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      let plan = await tx.projectPlan.findUnique({ where: { projectId } });
      if (!plan) {
        try {
          plan = await tx.projectPlan.create({
            data: {
              projectId,
              name: '项目自定义执行计划',
            },
          });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
            throw error;
          plan = await tx.projectPlan.findUniqueOrThrow({ where: { projectId } });
        }
      }
      const existing = await tx.projectStage.findFirst({
        where: { planId: plan.id, isCustom: true, name: '临时任务' },
        select: { id: true },
      });
      if (existing) return existing.id;
      const aggregate = await tx.projectStage.aggregate({
        where: { planId: plan.id },
        _max: { sortOrder: true },
      });
      return (
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
    });
  }

  async recomputeProject(projectId: string): Promise<void> {
    const plan = await this.prisma.projectPlan.findUnique({
      where: { projectId },
      select: {
        id: true,
        stages: {
          select: {
            id: true,
            workItems: {
              where: { status: { not: 'CANCELLED' } },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!plan) return;
    for (const stage of plan.stages) {
      for (const workItem of stage.workItems) await this.progress.recomputeWorkItem(workItem.id);
      if (stage.workItems.length === 0) await this.progress.recomputeStage(stage.id);
    }
    await this.progress.recomputePlan(plan.id);
  }
}

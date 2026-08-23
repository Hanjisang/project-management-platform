import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { calculateChecklistProgress, calculateWeightedProgress } from '@pmp/shared-utils';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async recomputeFromChecklist(planTaskId: string, client: DbClient = this.prisma): Promise<void> {
    const planTask = await client.projectPlanTask.findUnique({
      where: { id: planTaskId },
      include: { checklistItems: true },
    });
    if (!planTask) return;
    const progress =
      planTask.checklistItems.length > 0
        ? calculateChecklistProgress(planTask.checklistItems)
        : planTask.progress;
    await client.projectPlanTask.update({
      where: { id: planTaskId },
      data: {
        progress,
        actualStartDate:
          progress > 0 ? (planTask.actualStartDate ?? new Date()) : planTask.actualStartDate,
        actualEndDate: progress === 100 ? (planTask.actualEndDate ?? new Date()) : null,
      },
    });
    await this.recomputeStage(planTask.planStageId, client);
  }

  async recomputeStage(stageId: string, client: DbClient = this.prisma): Promise<void> {
    const stage = await client.projectPlanStage.findUnique({
      where: { id: stageId },
      include: { tasks: { select: { id: true, weight: true, progress: true } } },
    });
    if (!stage) return;
    const progress = calculateWeightedProgress(stage.tasks);
    await client.projectPlanStage.update({
      where: { id: stageId },
      data: {
        progress,
        actualStartDate:
          progress > 0 ? (stage.actualStartDate ?? new Date()) : stage.actualStartDate,
        actualEndDate: progress === 100 ? (stage.actualEndDate ?? new Date()) : null,
      },
    });
    await this.recomputePlan(stage.planId, client);
  }

  async recomputePlan(planId: string, client: DbClient = this.prisma): Promise<void> {
    const plan = await client.projectPlan.findUnique({
      where: { id: planId },
      include: { stages: { select: { id: true, weight: true, progress: true } } },
    });
    if (!plan) return;
    const progress = calculateWeightedProgress(plan.stages);
    await client.projectPlan.update({ where: { id: planId }, data: { progress } });
    await client.project.update({ where: { id: plan.projectId }, data: { progress } });
  }
}

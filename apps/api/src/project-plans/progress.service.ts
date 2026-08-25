import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { calculateWeightedProgress } from '@pmp/shared-utils';
import { DeliverableReviewDecisionService } from '../documents/deliverable-review-decision.service';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaClient;

export function calculateRequiredProgress(
  checklistItems: Array<{ required: boolean; completed: boolean }>,
  deliverables: Array<{ required: boolean; progressContribution: 0 | 0.5 | 1 }>,
  fallback: number,
): number {
  const requiredChecklist = checklistItems.filter((item) => item.required);
  const requiredDeliverables = deliverables.filter((item) => item.required);
  const totalUnits = requiredChecklist.length + requiredDeliverables.length;
  if (totalUnits === 0) return fallback;
  const completedUnits =
    requiredChecklist.filter((item) => item.completed).length +
    requiredDeliverables.reduce((sum, item) => sum + item.progressContribution, 0);
  return Math.round((completedUnits / totalUnits) * 100);
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewDecision: DeliverableReviewDecisionService,
  ) {}

  async recomputeFromChecklist(workItemId: string, client: DbClient = this.prisma): Promise<void> {
    await this.recomputeWorkItem(workItemId, client);
  }

  async recomputeWorkItem(workItemId: string, client: DbClient = this.prisma): Promise<void> {
    const workItem = await client.projectWorkItem.findUnique({
      where: { id: workItemId },
      include: {
        checklistItems: true,
        deliverables: {
          include: {
            documents: {
              where: { deletedAt: null },
              include: {
                versions: {
                  orderBy: { createdAt: 'desc' },
                  include: { reviews: { orderBy: { createdAt: 'desc' } } },
                },
              },
            },
          },
        },
      },
    });
    if (!workItem) return;
    const decisions = workItem.deliverables.map((deliverable) => ({
      required: deliverable.required,
      progressContribution: this.reviewDecision.decide(deliverable).progressContribution,
    }));
    const progress = calculateRequiredProgress(
      workItem.checklistItems,
      decisions,
      workItem.progress,
    );
    const completedUnits =
      workItem.checklistItems.filter((item) => item.required && item.completed).length +
      decisions
        .filter((item) => item.required)
        .reduce((sum, item) => sum + item.progressContribution, 0);
    const hasActivity = completedUnits > 0;
    await client.projectWorkItem.update({
      where: { id: workItemId },
      data: {
        progress,
        actualStartDate: hasActivity
          ? (workItem.actualStartDate ?? new Date())
          : workItem.actualStartDate,
        actualEndDate:
          workItem.status === 'DONE' && progress === 100
            ? (workItem.actualEndDate ?? new Date())
            : progress < 100
              ? null
              : workItem.actualEndDate,
        ...(workItem.status === 'TODO' && hasActivity ? { status: 'IN_PROGRESS' } : {}),
        ...(workItem.status === 'DONE' && progress < 100 ? { status: 'IN_PROGRESS' } : {}),
      },
    });
    await this.recomputeStage(workItem.planStageId, client);
  }

  async recomputeStage(stageId: string, client: DbClient = this.prisma): Promise<void> {
    const stage = await client.projectStage.findUnique({
      where: { id: stageId },
      include: {
        workItems: {
          where: { status: { not: 'CANCELLED' } },
          select: { id: true, weight: true, progress: true },
        },
      },
    });
    if (!stage) return;
    const progress = calculateWeightedProgress(stage.workItems);
    await client.projectStage.update({
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

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addBusinessDays, businessToday } from '@pmp/shared-utils';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}

  async overview(user: RequestUser) {
    const projects = await this.prisma.project.findMany({
      where: this.scope.where(user),
      select: {
        id: true,
        code: true,
        name: true,
        managerUserId: true,
        status: true,
        health: true,
        healthOverride: true,
        progress: true,
        plannedGoLiveDate: true,
        plans: {
          select: {
            stages: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, name: true, progress: true },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { plannedGoLiveDate: 'asc' }],
    });
    const projectIds = projects.map((project) => project.id);
    const today = businessToday();
    const upcoming = addBusinessDays(today, 30);
    const highRiskWhere: Prisma.IssueWhereInput = {
      projectId: { in: projectIds },
      severity: { in: ['HIGH', 'CRITICAL'] },
      status: { notIn: ['RESOLVED', 'CLOSED'] },
    };

    const [
      workItems,
      requiredChecklist,
      requiredDeliverables,
      pendingChanges,
      highRiskIssues,
      highRiskIssueCount,
      pendingMessages,
      taskLoads,
    ] = await Promise.all([
      this.prisma.projectWorkItem.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          id: true,
          projectId: true,
          name: true,
          status: true,
          progress: true,
          ownerUserId: true,
          plannedEndDate: true,
          sourceType: true,
          project: { select: { id: true, name: true } },
          owner: { select: { id: true, displayName: true } },
        },
        orderBy: { plannedEndDate: 'asc' },
      }),
      this.prisma.projectChecklistItem.findMany({
        where: { required: true, workItem: { projectId: { in: projectIds } } },
        select: {
          completed: true,
          workItem: { select: { projectId: true, plannedEndDate: true } },
        },
      }),
      this.prisma.projectDeliverable.findMany({
        where: { required: true, workItem: { projectId: { in: projectIds } } },
        select: {
          needsRevision: true,
          workItem: { select: { projectId: true } },
          documents: {
            where: { deletedAt: null },
            select: { status: true },
          },
        },
      }),
      this.prisma.projectChangeRequest.findMany({
        where: {
          projectId: { in: projectIds },
          status: { in: ['PENDING_APPROVAL', 'APPROVED', 'APPLYING'] },
        },
        select: { projectId: true },
      }),
      this.prisma.issue.findMany({
        where: highRiskWhere,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.issue.count({ where: highRiskWhere }),
      this.prisma.message.count({
        where: { projectId: { in: projectIds }, status: 'PENDING_CONFIRMATION' },
      }),
      this.prisma.projectWorkItem.groupBy({
        by: ['ownerUserId'],
        where: {
          projectId: { in: projectIds },
          ownerUserId: { not: null },
          status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
        },
        _count: { _all: true },
        _sum: { progress: true },
      }),
    ]);

    const activeWorkItems = workItems.filter((item) => item.status !== 'CANCELLED');
    const allOverdueTasks = activeWorkItems.filter(
      (item) =>
        item.plannedEndDate &&
        item.plannedEndDate < today &&
        !['DONE', 'CANCELLED'].includes(item.status),
    );
    const overdueTasks = allOverdueTasks.slice(0, 20);
    const overdueTaskCount = allOverdueTasks.length;
    const pendingSopTaskCount = activeWorkItems.filter(
      (item) => item.sourceType === 'SOP' && item.status !== 'DONE',
    ).length;
    const overdueChecklistCount = requiredChecklist.filter(
      (item) =>
        !item.completed && item.workItem.plannedEndDate && item.workItem.plannedEndDate < today,
    ).length;
    const requiredDeliverableNotSubmittedCount = requiredDeliverables.filter(
      (item) => item.documents.length === 0,
    ).length;
    const pendingDeliverableReviewCount = requiredDeliverables.filter(
      (item) => item.documents.some((document) => document.status === 'PENDING_REVIEW'),
    ).length;

    const ownerIds = taskLoads.flatMap((item) => (item.ownerUserId ? [item.ownerUserId] : []));
    const owners = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, displayName: true },
    });

    const stageDistribution = new Map<string, number>();
    for (const project of projects) {
      const stage =
        project.plans[0]?.stages.find((item) => item.progress < 100)?.name ??
        (project.status === 'COMPLETED' ? '已结项' : '未生成计划');
      stageDistribution.set(stage, (stageDistribution.get(stage) ?? 0) + 1);
    }
    const healthCounts: Record<string, number> = { NORMAL: 0, WARNING: 0, HIGH_RISK: 0 };
    for (const project of projects) {
      const health = this.effectiveHealth(project);
      healthCounts[health] = (healthCounts[health] ?? 0) + 1;
    }

    const myProjects = projects.map((project) => {
      const projectWorkItems = activeWorkItems.filter((item) => item.projectId === project.id);
      const projectChecklist = requiredChecklist.filter(
        (item) => item.workItem.projectId === project.id,
      );
      const projectDeliverables = requiredDeliverables.filter(
        (item) => item.workItem.projectId === project.id,
      );
      const currentStage =
        project.plans[0]?.stages.find((stage) => stage.progress < 100)?.name ??
        (project.status === 'COMPLETED' ? '已结项' : '未生成计划');
      return {
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        health: this.effectiveHealth(project),
        progress: project.progress,
        isManager: project.managerUserId === user.id,
        currentStage,
        plannedGoLiveDate: project.plannedGoLiveDate,
        workItems: {
          done: projectWorkItems.filter((item) => item.status === 'DONE').length,
          total: projectWorkItems.length,
        },
        checklist: {
          done: projectChecklist.filter((item) => item.completed).length,
          total: projectChecklist.length,
        },
        deliverables: {
          approved: projectDeliverables.filter(
            (item) =>
              !item.needsRevision &&
              item.documents.some((document) => document.status === 'APPROVED'),
          ).length,
          total: projectDeliverables.length,
        },
        overdueCount: projectWorkItems.filter(
          (item) =>
            item.plannedEndDate && item.plannedEndDate < today && item.status !== 'DONE',
        ).length,
        blockedCount: projectWorkItems.filter((item) => item.status === 'BLOCKED').length,
        unsubmittedRequiredDeliverables: projectDeliverables.filter(
          (item) => item.documents.length === 0,
        ).length,
        pendingReviewCount: projectDeliverables.filter((item) =>
          item.documents.some((document) => document.status === 'PENDING_REVIEW'),
        ).length,
        pendingChangeCount: pendingChanges.filter((item) => item.projectId === project.id).length,
      };
    });

    return {
      myProjects,
      summary: {
        projectCount: projects.length,
        ...healthCounts,
        delayedProjectCount: projects.filter(
          (item) =>
            item.plannedGoLiveDate &&
            item.plannedGoLiveDate < today &&
            !['COMPLETED', 'CANCELLED'].includes(item.status),
        ).length,
        upcomingGoLiveCount: projects.filter(
          (item) =>
            item.plannedGoLiveDate &&
            item.plannedGoLiveDate >= today &&
            item.plannedGoLiveDate <= upcoming,
        ).length,
        overdueTaskCount,
        highRiskIssueCount,
        pendingMessageCount: pendingMessages,
        pendingSopTaskCount,
        overdueChecklistCount,
        requiredDeliverableNotSubmittedCount,
        pendingDeliverableReviewCount,
      },
      upcomingProjects: projects
        .filter(
          (item) =>
            item.plannedGoLiveDate &&
            item.plannedGoLiveDate >= today &&
            item.plannedGoLiveDate <= upcoming,
        )
        .sort((a, b) => a.plannedGoLiveDate!.getTime() - b.plannedGoLiveDate!.getTime()),
      stageDistribution: [...stageDistribution].map(([name, value]) => ({ name, value })),
      progressRanking: [...projects]
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 10)
        .map((project) => this.projectSummary(project)),
      riskRanking: [...projects]
        .sort(
          (a, b) =>
            this.healthRank(this.effectiveHealth(b)) - this.healthRank(this.effectiveHealth(a)) ||
            a.progress - b.progress,
        )
        .slice(0, 10)
        .map((project) => this.projectSummary(project)),
      overdueTasks,
      highRiskIssues,
      workload: taskLoads
        .map((item) => ({
          userId: item.ownerUserId,
          displayName:
            owners.find((owner) => owner.id === item.ownerUserId)?.displayName ?? '未知用户',
          activeTaskCount: item._count._all,
          averageProgress: item._count._all
            ? Math.round((item._sum.progress ?? 0) / item._count._all)
            : 0,
        }))
        .sort((a, b) => b.activeTaskCount - a.activeTaskCount),
    };
  }

  private healthRank(value: string): number {
    return { NORMAL: 0, WARNING: 1, HIGH_RISK: 2 }[value] ?? 0;
  }

  private projectSummary(project: {
    id: string;
    code: string;
    name: string;
    status: string;
    health: string;
    healthOverride?: string | null;
    progress: number;
    plannedGoLiveDate: Date | null;
  }) {
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      health: this.effectiveHealth(project),
      derivedHealth: project.health,
      effectiveHealth: this.effectiveHealth(project),
      progress: project.progress,
      plannedGoLiveDate: project.plannedGoLiveDate,
    };
  }

  private effectiveHealth(project: { health: string; healthOverride?: string | null }): string {
    return project.healthOverride ?? project.health;
  }
}

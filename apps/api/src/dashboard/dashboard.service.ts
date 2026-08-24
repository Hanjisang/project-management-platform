import { Injectable } from '@nestjs/common';
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
        status: true,
        health: true,
        healthOverride: true,
        progress: true,
        plannedGoLiveDate: true,
        plans: {
          select: {
            stages: { orderBy: { sortOrder: 'asc' }, select: { name: true, progress: true } },
          },
        },
      },
    });
    const projectIds = projects.map((project) => project.id);
    const today = businessToday();
    const upcoming = addBusinessDays(today, 30);
    const [
      overdueTasks,
      overdueTaskCount,
      highRiskIssues,
      highRiskIssueCount,
      pendingMessages,
      taskLoads,
    ] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          dueDate: { lt: today },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        include: {
          project: { select: { id: true, name: true } },
          owner: { select: { id: true, displayName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      this.prisma.task.count({
        where: {
          projectId: { in: projectIds },
          dueDate: { lt: today },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
      this.prisma.issue.findMany({
        where: {
          projectId: { in: projectIds },
          severity: { in: ['HIGH', 'CRITICAL'] },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.issue.count({
        where: {
          projectId: { in: projectIds },
          severity: { in: ['HIGH', 'CRITICAL'] },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      }),
      this.prisma.message.count({
        where: { projectId: { in: projectIds }, status: 'PENDING_CONFIRMATION' },
      }),
      this.prisma.task.groupBy({
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
    return {
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

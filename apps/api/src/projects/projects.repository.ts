import { Injectable } from '@nestjs/common';
import { Prisma, type ProjectStatus, type ProjectHealth, type ProjectRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectWritable, lockProject } from './project-mutation';
import { DeliverableReviewDecisionService } from '../documents/deliverable-review-decision.service';

type ClosureBlockers = Awaited<ReturnType<ProjectsRepository['closureBlockers']>>;
type CloseResult =
  | { kind: 'closed'; project: Awaited<ReturnType<ProjectsRepository['updateStatus']>> }
  | { kind: 'blocked'; blockers: ClosureBlockers }
  | { kind: 'invalid_status'; status: ProjectStatus }
  | { kind: 'not_found' };

@Injectable()
export class ProjectsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliverables: DeliverableReviewDecisionService,
  ) {}
  async list(where: Prisma.ProjectWhereInput, page: number, pageSize: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: {
          manager: { select: { id: true, displayName: true } },
          _count: { select: { members: true, workItems: true, issues: true } },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }
  find(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        manager: { select: { id: true, username: true, displayName: true } },
        approver: { select: { id: true, username: true, displayName: true } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, username: true, status: true } },
          },
        },
        plans: { include: { sourceVersion: { include: { template: true } } } },
        _count: { select: { workItems: true, issues: true, documents: true, messages: true } },
      },
    });
  }
  create(data: {
    code: string;
    name: string;
    customerName: string;
    managerUserId: string;
    approverUserId?: string;
    plannedStartDate?: Date;
    plannedGoLiveDate?: Date;
    description?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const requiredUsers = [
        data.managerUserId,
        ...(data.approverUserId ? [data.approverUserId] : []),
      ];
      if (
        (await tx.user.count({
          where: { id: { in: requiredUsers }, status: 'ACTIVE', deletedAt: null },
        })) !== new Set(requiredUsers).size
      )
        return null;
      return tx.project.create({
        data: {
          ...data,
          members: {
            createMany: {
              data: [
                { userId: data.managerUserId, projectRole: 'PROJECT_MANAGER' },
                ...(data.approverUserId && data.approverUserId !== data.managerUserId
                  ? [{ userId: data.approverUserId, projectRole: 'VIEWER' as const }]
                  : []),
              ],
              skipDuplicates: true,
            },
          },
        },
        include: {
          manager: { select: { id: true, displayName: true } },
          approver: { select: { id: true, displayName: true } },
          members: true,
        },
      });
    });
  }
  update(id: string, data: Prisma.ProjectUpdateInput) {
    return this.prisma.project.update({
      where: { id },
      data,
      include: {
        manager: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
      },
    });
  }
  updateStatus(id: string, status: ProjectStatus, additional: Prisma.ProjectUpdateInput = {}) {
    return this.prisma.project.update({ where: { id }, data: { status, ...additional } });
  }
  async ensureBaseline(projectId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      const existing = await tx.projectBaseline.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
      });
      if (existing) return existing;
      const [project, plan] = await Promise.all([
        tx.project.findUnique({ where: { id: projectId } }),
        tx.projectPlan.findUnique({
          where: { projectId },
          include: {
            stages: {
              orderBy: { sortOrder: 'asc' },
              include: {
                workItems: {
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
      if (
        !project?.plannedStartDate ||
        !project.plannedGoLiveDate ||
        project.plannedGoLiveDate <= project.plannedStartDate ||
        !plan
      )
        return null;
      return tx.projectBaseline.create({
        data: {
          projectId,
          version: 1,
          plannedStartDate: project.plannedStartDate,
          plannedCompletionDate: project.plannedGoLiveDate,
          createdByUserId: userId,
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
    });
  }
  updateHealth(id: string, health: ProjectHealth) {
    return this.prisma.project.update({ where: { id }, data: { health } });
  }
  softDelete(id: string) {
    return this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }
  members(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        manager: { select: { id: true, displayName: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, status: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }
  setMembers(
    projectId: string,
    managerUserId: string,
    members: Array<{ userId: string; projectRole: ProjectRole }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, projectId);
      const userIds = [...new Set(members.map((member) => member.userId).concat(managerUserId))];
      const activeCount = await tx.user.count({
        where: { id: { in: userIds }, status: 'ACTIVE', deletedAt: null },
      });
      if (activeCount !== userIds.length) return false;
      await tx.projectMember.deleteMany({ where: { projectId } });
      const normalized = members
        .filter((member) => member.userId !== managerUserId)
        .concat({ userId: managerUserId, projectRole: 'PROJECT_MANAGER' });
      await tx.projectMember.createMany({
        data: normalized.map((member) => ({
          projectId,
          userId: member.userId,
          projectRole: member.projectRole,
        })),
        skipDuplicates: true,
      });
      return tx.project.update({
        where: { id: projectId },
        data: { managerUserId },
        include: { members: { include: { user: { select: { id: true, displayName: true } } } } },
      });
    });
  }
  closureBlockers(projectId: string) {
    return this.prisma.$transaction((tx) => this.closureBlockersWith(tx, projectId));
  }
  async close(projectId: string): Promise<CloseResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const project = await lockProject(tx, projectId);
            if (!project) return { kind: 'not_found' };
            if (!['ACTIVE', 'PAUSED'].includes(project.status))
              return { kind: 'invalid_status', status: project.status };
            const blockers = await this.closureBlockersWith(tx, projectId);
            if (Object.values(blockers).some((items) => items.length > 0))
              return { kind: 'blocked', blockers };
            const closed = await tx.project.update({
              where: { id: projectId },
              data: {
                status: 'COMPLETED',
                actualGoLiveDate: project.actualGoLiveDate ?? new Date(),
                progress: 100,
              },
            });
            return { kind: 'closed', project: closed };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          attempt === 2 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034'
        )
          throw error;
      }
    }
    throw new Error('Unreachable project close retry state');
  }
  private async closureBlockersWith(tx: Prisma.TransactionClient, projectId: string) {
    const incompleteWorkItems = await tx.projectWorkItem.findMany({
      where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] } },
      select: { id: true, name: true },
    });
    const openHighPriorityIssues = await tx.issue.findMany({
      where: {
        projectId,
        severity: { in: ['HIGH', 'CRITICAL'] },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      select: { id: true, title: true },
    });
    const planDeliverables = await tx.projectDeliverable.findMany({
      where: { workItem: { projectId }, required: true },
      select: {
        id: true,
        name: true,
        reviewMode: true,
        needsRevision: true,
        workItem: { select: { name: true } },
        documents: {
          where: { deletedAt: null },
          select: {
            versions: {
              orderBy: { createdAt: 'desc' },
              select: {
                createdAt: true,
                reviews: {
                  orderBy: { createdAt: 'desc' },
                  select: { reviewType: true, status: true, createdAt: true },
                },
              },
            },
          },
        },
      },
    });
    const missingRequiredDeliverables = planDeliverables
      .filter((item) => !this.deliverables.decide(item).approved)
      .map((item) => ({
        id: item.id,
        planTaskName: item.workItem.name,
        deliverableName: item.name,
        reason: this.deliverables.decide(item).effectiveStatus,
      }));
    const pendingChangeRequests = await tx.projectChangeRequest.findMany({
      where: { projectId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'APPLYING'] } },
      select: { id: true, code: true, status: true },
    });
    return {
      incompleteWorkItems,
      openHighPriorityIssues,
      missingRequiredDeliverables,
      pendingChangeRequests,
    };
  }
  prismaClient() {
    return this.prisma;
  }
  async activeUserOptions(search: string | undefined, page: number, pageSize: number) {
    const where: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      ...(search
        ? { OR: [{ username: { contains: search } }, { displayName: { contains: search } }] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: { id: true, username: true, displayName: true },
        orderBy: { displayName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }
}

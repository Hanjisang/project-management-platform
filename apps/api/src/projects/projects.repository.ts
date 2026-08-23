import { Injectable } from '@nestjs/common';
import { Prisma, type ProjectStatus, type ProjectHealth, type ProjectRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(where: Prisma.ProjectWhereInput, page: number, pageSize: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: {
          manager: { select: { id: true, displayName: true } },
          _count: { select: { members: true, tasks: true, issues: true } },
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
        members: {
          include: {
            user: { select: { id: true, displayName: true, username: true, status: true } },
          },
        },
        plans: { include: { sourceVersion: { include: { template: true } } } },
        _count: { select: { tasks: true, issues: true, documents: true, messages: true } },
      },
    });
  }
  create(data: {
    code: string;
    name: string;
    customerName: string;
    managerUserId: string;
    plannedStartDate?: Date;
    plannedGoLiveDate?: Date;
    description?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const manager = await tx.user.findFirst({
        where: { id: data.managerUserId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!manager) return null;
      return tx.project.create({
        data: {
          ...data,
          members: { create: { userId: data.managerUserId, projectRole: 'PROJECT_MANAGER' } },
        },
        include: { manager: { select: { id: true, displayName: true } }, members: true },
      });
    });
  }
  update(id: string, data: Prisma.ProjectUpdateInput) {
    return this.prisma.project.update({
      where: { id },
      data,
      include: { manager: { select: { id: true, displayName: true } } },
    });
  }
  updateStatus(id: string, status: ProjectStatus, additional: Prisma.ProjectUpdateInput = {}) {
    return this.prisma.project.update({ where: { id }, data: { status, ...additional } });
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
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) return null;
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
    return this.prisma.$transaction(async (tx) => {
      const incompletePlanTasks = await tx.projectPlanTask.findMany({
        where: { stage: { plan: { projectId } }, required: true, progress: { lt: 100 } },
        select: { id: true, name: true },
      });
      const incompleteTasks = await tx.task.findMany({
        where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] } },
        select: { id: true, title: true },
      });
      const openHighPriorityIssues = await tx.issue.findMany({
        where: {
          projectId,
          severity: { in: ['HIGH', 'CRITICAL'] },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
        select: { id: true, title: true },
      });
      const planDeliverables = await tx.projectPlanTask.findMany({
        where: { stage: { plan: { projectId } }, deliverableRequired: true },
        select: {
          id: true,
          name: true,
          documents: { where: { deletedAt: null, status: 'APPROVED' }, select: { id: true } },
        },
      });
      const requiredDocuments = await tx.document.findMany({
        where: { projectId, required: true, deletedAt: null, status: { not: 'APPROVED' } },
        select: { id: true, name: true },
      });
      const missingRequiredDeliverables = [
        ...planDeliverables
          .filter((item) => item.documents.length === 0)
          .map((item) => ({ id: item.id, name: item.name })),
        ...requiredDocuments,
      ];
      return {
        incompletePlanTasks,
        incompleteTasks,
        openHighPriorityIssues,
        missingRequiredDeliverables,
      };
    });
  }
  prismaClient() {
    return this.prisma;
  }
  activeUserOptions() {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, username: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }
}

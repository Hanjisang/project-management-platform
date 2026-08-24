import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { businessDayEndInstant, businessDayStartInstant } from '@pmp/shared-utils';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import type { GenerateWeeklyReportDto, UpsertDailyReportDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}
  async dailyList(user: RequestUser, projectId?: string, from?: string, to?: string) {
    if (projectId) await this.scope.assert(user, projectId);
    return this.prisma.dailyReport.findMany({
      where: {
        project: this.scope.where(user),
        ...(projectId ? { projectId } : {}),
        ...(from || to
          ? {
              reportDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        reporter: { select: { id: true, displayName: true } },
      },
      orderBy: { reportDate: 'desc' },
    });
  }
  async upsertDaily(user: RequestUser, dto: UpsertDailyReportDto) {
    await this.scope.assert(user, dto.projectId);
    const key = {
      projectId_reportDate_reporterId: {
        projectId: dto.projectId,
        reportDate: dto.reportDate,
        reporterId: user.id,
      },
    };
    const data = {
      completed: dto.completed as Prisma.InputJsonValue,
      risks: dto.risks as Prisma.InputJsonValue,
      coordination: dto.coordination as Prisma.InputJsonValue,
      tomorrow: dto.tomorrow as Prisma.InputJsonValue,
      notes: dto.notes,
    };
    return this.prisma.dailyReport.upsert({
      where: key,
      create: {
        projectId: dto.projectId,
        reportDate: dto.reportDate,
        reporterId: user.id,
        ...data,
      },
      update: data,
    });
  }
  async generateWeekly(user: RequestUser, dto: GenerateWeeklyReportDto) {
    if (dto.weekStart > dto.weekEnd)
      throw new BadRequestException({
        code: 'REPORT_DATE_INVALID',
        message: '周期开始日期不能晚于结束日期',
      });
    if (dto.projectId) await this.scope.assert(user, dto.projectId);
    const projectWhere = {
      ...this.scope.where(user),
      ...(dto.projectId ? { id: dto.projectId } : {}),
    };
    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      select: { id: true, code: true, name: true, progress: true, health: true },
    });
    const ids = projects.map((project) => project.id);
    const [tasks, issues, reports, messages] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          projectId: { in: ids },
          updatedAt: {
            gte: businessDayStartInstant(dto.weekStart),
            lte: businessDayEndInstant(dto.weekEnd),
          },
        },
        select: { projectId: true, title: true, status: true, progress: true },
      }),
      this.prisma.issue.findMany({
        where: {
          projectId: { in: ids },
          updatedAt: {
            gte: businessDayStartInstant(dto.weekStart),
            lte: businessDayEndInstant(dto.weekEnd),
          },
        },
        select: { projectId: true, title: true, type: true, severity: true, status: true },
      }),
      this.prisma.dailyReport.findMany({
        where: { projectId: { in: ids }, reportDate: { gte: dto.weekStart, lte: dto.weekEnd } },
        select: {
          projectId: true,
          completed: true,
          risks: true,
          coordination: true,
          tomorrow: true,
        },
      }),
      this.prisma.message.count({
        where: {
          projectId: { in: ids },
          receivedAt: {
            gte: businessDayStartInstant(dto.weekStart),
            lte: businessDayEndInstant(dto.weekEnd),
          },
        },
      }),
    ]);
    const content = {
      projects,
      tasks,
      issues,
      dailyReports: reports,
      messageCount: messages,
      generatedAt: new Date().toISOString(),
    };
    return this.prisma.weeklyReport.create({
      data: {
        projectId: dto.projectId,
        department: dto.department,
        weekStart: dto.weekStart,
        weekEnd: dto.weekEnd,
        content,
        createdById: user.id,
      },
    });
  }
  listWeekly(user: RequestUser) {
    return this.prisma.weeklyReport.findMany({
      where: {
        OR: [{ project: this.scope.where(user) }, { projectId: null, createdById: user.id }],
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

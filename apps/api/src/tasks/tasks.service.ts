import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { assertProjectWritable } from '../projects/project-mutation';
import type { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './dto';
import { assertTaskDates, normalizeTaskUpdate } from './task-state';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly projects: ProjectsService,
  ) {}
  async list(user: RequestUser, query: TaskListQueryDto) {
    if (query.projectId) await this.scope.assert(user, query.projectId);
    const where: Prisma.TaskWhereInput = {
      project: this.scope.where(user),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: {
          project: { select: { id: true, code: true, name: true } },
          owner: { select: { id: true, displayName: true } },
          planTask: { select: { id: true, name: true } },
          zentaoSync: true,
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }
  async get(user: RequestUser, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        owner: { select: { id: true, displayName: true } },
        planTask: true,
        zentaoSync: true,
      },
    });
    if (!task) throw this.notFound();
    await this.scope.assert(user, task.projectId);
    return task;
  }
  async create(user: RequestUser, dto: CreateTaskDto) {
    await this.scope.assert(user, dto.projectId);
    await this.validateReferences(dto.projectId, dto.ownerUserId, dto.planTaskId);
    assertTaskDates(dto.plannedStartDate, dto.dueDate);
    const task = await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, dto.projectId);
      return tx.task.create({
        data: {
          ...dto,
          title: dto.title.trim(),
          priority: dto.priority ?? 'MEDIUM',
          sourceType: dto.sourceType ?? 'MANUAL',
          createdById: user.id,
        },
      });
    });
    await this.projects.recomputeHealth(dto.projectId);
    return task;
  }
  async update(user: RequestUser, id: string, dto: UpdateTaskDto) {
    const existing = await this.get(user, id);
    await this.validateReferences(existing.projectId, dto.ownerUserId, undefined);
    assertTaskDates(
      dto.plannedStartDate ?? existing.plannedStartDate ?? undefined,
      dto.dueDate ?? existing.dueDate ?? undefined,
    );
    const normalized = normalizeTaskUpdate(existing, dto);
    const task = await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, existing.projectId);
      return tx.task.update({
        where: { id },
        data: {
          ...dto,
          ...normalized,
        },
      });
    });
    await this.projects.recomputeHealth(existing.projectId);
    return task;
  }
  async remove(user: RequestUser, id: string): Promise<void> {
    const task = await this.get(user, id);
    if (task.status === 'DONE')
      throw new ConflictException({
        code: 'COMPLETED_TASK_DELETE_FORBIDDEN',
        message: '已完成任务不能直接删除，可改为取消',
      });
    await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, task.projectId);
      await tx.task.delete({ where: { id } });
    });
    await this.projects.recomputeHealth(task.projectId);
  }
  async complete(user: RequestUser, id: string) {
    const existing = await this.get(user, id);
    if (existing.status === 'CANCELLED')
      throw new ConflictException({
        code: 'TASK_STATUS_TRANSITION_INVALID',
        message: '已取消任务不能直接完成',
        details: { from: existing.status, to: 'DONE' },
      });
    const task = await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, existing.projectId);
      return tx.task.update({
        where: { id },
        data: { status: 'DONE', progress: 100, completedAt: existing.completedAt ?? new Date() },
      });
    });
    await this.projects.recomputeHealth(existing.projectId);
    return task;
  }
  private async validateReferences(projectId: string, ownerUserId?: string, planTaskId?: string) {
    if (ownerUserId) {
      const count = await this.prisma.projectMember.count({
        where: { projectId, userId: ownerUserId },
      });
      if (!count)
        throw new BadRequestException({
          code: 'TASK_OWNER_INVALID',
          message: '任务负责人必须是项目成员',
        });
    }
    if (planTaskId) {
      const count = await this.prisma.projectPlanTask.count({
        where: { id: planTaskId, stage: { plan: { projectId } } },
      });
      if (!count)
        throw new BadRequestException({
          code: 'PLAN_TASK_INVALID',
          message: '关联的计划节点不属于该项目',
        });
    }
  }
  private notFound() {
    return new NotFoundException({ code: 'TASK_NOT_FOUND', message: '任务不存在' });
  }
}

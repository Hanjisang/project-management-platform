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
import type { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './dto';

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
    const task = await this.prisma.task.create({
      data: {
        ...dto,
        title: dto.title.trim(),
        priority: dto.priority ?? 'MEDIUM',
        sourceType: dto.sourceType ?? 'MANUAL',
        createdById: user.id,
      },
    });
    await this.projects.recomputeHealth(dto.projectId);
    return task;
  }
  async update(user: RequestUser, id: string, dto: UpdateTaskDto) {
    const existing = await this.get(user, id);
    await this.validateReferences(existing.projectId, dto.ownerUserId, undefined);
    if (dto.plannedStartDate && dto.dueDate && dto.plannedStartDate > dto.dueDate)
      throw new BadRequestException({
        code: 'TASK_DATE_INVALID',
        message: '计划开始日期不能晚于截止日期',
      });
    const status = dto.status ?? (dto.progress === 100 ? 'DONE' : undefined);
    const progress = status === 'DONE' ? 100 : dto.progress;
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        status,
        progress,
        completedAt:
          status === 'DONE' ? (existing.completedAt ?? new Date()) : status ? null : undefined,
      },
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
    await this.prisma.task.delete({ where: { id } });
    await this.projects.recomputeHealth(task.projectId);
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

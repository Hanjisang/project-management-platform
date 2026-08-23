import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ProjectStatus } from '@prisma/client';
import { deriveProjectHealth } from '@pmp/shared-utils';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import type {
  CreateProjectDto,
  ProjectListQueryDto,
  SetProjectMembersDto,
  UpdateProjectDto,
} from './dto';
import { ProjectsRepository } from './projects.repository';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly scope: ProjectScopeService,
  ) {}
  userOptions() {
    return this.repository.activeUserOptions();
  }
  list(user: RequestUser, query: ProjectListQueryDto) {
    const where: Prisma.ProjectWhereInput = {
      ...this.scope.where(user),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
              { customerName: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status as ProjectStatus } : {}),
      ...(query.health ? { health: query.health as never } : {}),
    };
    return this.repository.list(where, query.page, query.pageSize);
  }
  async get(user: RequestUser, id: string) {
    await this.scope.assert(user, id);
    const project = await this.repository.find(id);
    if (!project) throw this.notFound();
    return project;
  }
  async create(dto: CreateProjectDto) {
    if (
      dto.plannedStartDate &&
      dto.plannedGoLiveDate &&
      dto.plannedStartDate > dto.plannedGoLiveDate
    )
      throw new BadRequestException({
        code: 'PROJECT_DATE_INVALID',
        message: '计划开始日期不能晚于上线日期',
      });
    const project = await this.repository.create({
      ...dto,
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      customerName: dto.customerName.trim(),
    });
    if (!project)
      throw new BadRequestException({
        code: 'PROJECT_MANAGER_INVALID',
        message: '项目负责人不存在或不可用',
      });
    return project;
  }
  async update(user: RequestUser, id: string, dto: UpdateProjectDto) {
    await this.scope.assert(user, id);
    const existing = await this.repository.find(id);
    if (!existing) throw this.notFound();
    if (
      dto.managerUserId &&
      !existing.members.some((member) => member.userId === dto.managerUserId)
    )
      throw new BadRequestException({
        code: 'MANAGER_MUST_BE_MEMBER',
        message: '新负责人必须先加入项目成员',
      });
    return this.repository.update(id, {
      name: dto.name,
      customerName: dto.customerName,
      description: dto.description,
      plannedStartDate: dto.plannedStartDate,
      plannedGoLiveDate: dto.plannedGoLiveDate,
      healthOverride: dto.healthOverride,
      manager: dto.managerUserId ? { connect: { id: dto.managerUserId } } : undefined,
    });
  }
  async start(user: RequestUser, id: string) {
    const project = await this.get(user, id);
    if (project.status !== 'NOT_STARTED') throw this.invalidTransition(project.status, 'ACTIVE');
    if (project.plans.length === 0)
      throw new ConflictException({
        code: 'PROJECT_PLAN_REQUIRED',
        message: '启动项目前必须生成实施计划',
      });
    return this.repository.updateStatus(id, 'ACTIVE', { actualStartDate: new Date() });
  }
  async pause(user: RequestUser, id: string) {
    const project = await this.get(user, id);
    if (project.status !== 'ACTIVE') throw this.invalidTransition(project.status, 'PAUSED');
    return this.repository.updateStatus(id, 'PAUSED');
  }
  async resume(user: RequestUser, id: string) {
    const project = await this.get(user, id);
    if (project.status !== 'PAUSED') throw this.invalidTransition(project.status, 'ACTIVE');
    return this.repository.updateStatus(id, 'ACTIVE');
  }
  async close(user: RequestUser, id: string) {
    const project = await this.get(user, id);
    if (!['ACTIVE', 'PAUSED'].includes(project.status))
      throw this.invalidTransition(project.status, 'COMPLETED');
    const blockers = await this.repository.closureBlockers(id);
    if (Object.values(blockers).some((items) => items.length > 0))
      throw new ConflictException({
        code: 'PROJECT_CLOSE_BLOCKED',
        message: '项目存在未完成项，暂时无法结项',
        details: blockers,
      });
    return this.repository.updateStatus(id, 'COMPLETED', {
      actualGoLiveDate: project.actualGoLiveDate ?? new Date(),
      progress: 100,
    });
  }
  async remove(user: RequestUser, id: string) {
    const project = await this.get(user, id);
    if (project.status === 'ACTIVE')
      throw new ConflictException({
        code: 'ACTIVE_PROJECT_DELETE_FORBIDDEN',
        message: '进行中项目不能删除',
      });
    return this.repository.softDelete(id);
  }
  async members(user: RequestUser, id: string) {
    await this.scope.assert(user, id);
    const result = await this.repository.members(id);
    if (!result) throw this.notFound();
    return result;
  }
  async setMembers(user: RequestUser, id: string, dto: SetProjectMembersDto) {
    await this.scope.assert(user, id);
    const project = await this.repository.find(id);
    if (!project) throw this.notFound();
    const duplicate =
      dto.members.length !== new Set(dto.members.map((member) => member.userId)).size;
    if (duplicate)
      throw new BadRequestException({
        code: 'PROJECT_MEMBER_DUPLICATE',
        message: '项目成员不能重复',
      });
    const result = await this.repository.setMembers(id, project.managerUserId, dto.members);
    if (result === false)
      throw new BadRequestException({ code: 'PROJECT_MEMBER_INVALID', message: '存在不可用用户' });
    if (!result) throw this.notFound();
    return result;
  }
  async recomputeHealth(projectId: string): Promise<void> {
    const prisma = this.repository.prismaClient();
    const [overdueTaskCount, criticalIssueCount, highIssueCount, risk] = await Promise.all([
      prisma.task.count({
        where: { projectId, dueDate: { lt: new Date() }, status: { notIn: ['DONE', 'CANCELLED'] } },
      }),
      prisma.issue.count({
        where: { projectId, severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
      prisma.issue.count({
        where: { projectId, severity: 'HIGH', status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
      prisma.issue.aggregate({
        where: { projectId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        _max: { riskScore: true },
      }),
    ]);
    await this.repository.updateHealth(
      projectId,
      deriveProjectHealth({
        overdueTaskCount,
        criticalIssueCount,
        highIssueCount,
        maxRiskScore: risk._max.riskScore ?? 0,
      }),
    );
  }
  private notFound() {
    return new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '项目不存在' });
  }
  private invalidTransition(from: string, to: string) {
    return new ConflictException({
      code: 'PROJECT_STATUS_TRANSITION_INVALID',
      message: '项目状态不允许此操作',
      details: { from, to },
    });
  }
}

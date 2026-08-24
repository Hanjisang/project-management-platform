import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ProjectStatus } from '@prisma/client';
import { businessToday, deriveProjectHealth } from '@pmp/shared-utils';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import type {
  CreateProjectDto,
  ProjectListQueryDto,
  ProjectUserOptionsQueryDto,
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
  userOptions(query: ProjectUserOptionsQueryDto) {
    return this.repository.activeUserOptions(query.search, query.page, query.pageSize);
  }
  async list(user: RequestUser, query: ProjectListQueryDto) {
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
      ...(query.health
        ? {
            OR: [
              { healthOverride: query.health as never },
              { healthOverride: null, health: query.health as never },
            ],
          }
        : {}),
    };
    const result = await this.repository.list(where, query.page, query.pageSize);
    return { ...result, items: result.items.map((project) => this.withEffectiveHealth(project)) };
  }
  async get(user: RequestUser, id: string) {
    await this.scope.assert(user, id);
    const project = await this.repository.find(id);
    if (!project) throw this.notFound();
    return this.withEffectiveHealth(project);
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
    if (['COMPLETED', 'CANCELLED'].includes(existing.status))
      throw new ConflictException({
        code: 'PROJECT_READ_ONLY',
        message: '已结项或已取消的项目不允许修改',
        details: { status: existing.status },
      });
    const finalStart = dto.plannedStartDate ?? existing.plannedStartDate;
    const finalGoLive = dto.plannedGoLiveDate ?? existing.plannedGoLiveDate;
    if (finalStart && finalGoLive && finalStart > finalGoLive)
      throw new BadRequestException({
        code: 'PROJECT_DATE_INVALID',
        message: '计划开始日期不能晚于上线日期',
      });
    if (
      dto.managerUserId &&
      !existing.members.some((member) => member.userId === dto.managerUserId)
    )
      throw new BadRequestException({
        code: 'MANAGER_MUST_BE_MEMBER',
        message: '新负责人必须先加入项目成员',
      });
    if (
      dto.approverUserId &&
      !existing.members.some((member) => member.userId === dto.approverUserId)
    )
      throw new BadRequestException({
        code: 'APPROVER_MUST_BE_MEMBER',
        message: '审批负责人必须先加入项目成员',
      });
    return this.withEffectiveHealth(
      await this.repository.update(id, {
        name: dto.name,
        customerName: dto.customerName,
        description: dto.description,
        plannedStartDate: dto.plannedStartDate,
        plannedGoLiveDate: dto.plannedGoLiveDate,
        healthOverride: dto.healthOverride,
        manager: dto.managerUserId ? { connect: { id: dto.managerUserId } } : undefined,
        approver: dto.approverUserId ? { connect: { id: dto.approverUserId } } : undefined,
      }),
    );
  }
  async start(user: RequestUser, id: string) {
    const project = await this.get(user, id);
    if (project.status !== 'NOT_STARTED') throw this.invalidTransition(project.status, 'ACTIVE');
    if (project.plans.length === 0)
      throw new ConflictException({
        code: 'PROJECT_PLAN_REQUIRED',
        message: '启动项目前必须生成实施计划',
      });
    if (!project.approverUserId)
      throw new ConflictException({
        code: 'PROJECT_APPROVER_REQUIRED',
        message: '启动项目前必须配置审批负责人',
      });
    if (!(await this.repository.ensureBaseline(id, user.id)))
      throw new ConflictException({
        code: 'PROJECT_BASELINE_REQUIRED',
        message: '启动项目前必须设置合法计划日期并建立基线',
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
    await this.scope.assert(user, id);
    const result = await this.repository.close(id);
    if (result.kind === 'not_found') throw this.notFound();
    if (result.kind === 'invalid_status') throw this.invalidTransition(result.status, 'COMPLETED');
    if (result.kind === 'blocked')
      throw new ConflictException({
        code: 'PROJECT_CLOSE_BLOCKED',
        message: '项目存在未完成项，暂时无法结项',
        details: result.blockers,
      });
    return result.project;
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
    if (['COMPLETED', 'CANCELLED'].includes(project.status))
      throw new ConflictException({
        code: 'PROJECT_READ_ONLY',
        message: '已结项或已取消的项目不允许修改成员',
        details: { status: project.status },
      });
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
      prisma.projectWorkItem.count({
        where: {
          projectId,
          plannedEndDate: { lt: businessToday() },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
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
  private withEffectiveHealth<T extends { health: string; healthOverride?: string | null }>(
    project: T,
  ): T & { derivedHealth: string; effectiveHealth: string } {
    const derivedHealth = project.health;
    const effectiveHealth = project.healthOverride ?? derivedHealth;
    return { ...project, health: effectiveHealth, derivedHealth, effectiveHealth };
  }
  private invalidTransition(from: string, to: string) {
    return new ConflictException({
      code: 'PROJECT_STATUS_TRANSITION_INVALID',
      message: '项目状态不允许此操作',
      details: { from, to },
    });
  }
}

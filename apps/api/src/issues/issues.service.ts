import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calculateRiskScore } from '@pmp/shared-utils';
import type { RequestUser } from '../common/types';
import { ProjectScopeService } from '../auth/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { assertProjectWritable } from '../projects/project-mutation';
import type { CreateIssueDto, IssueListQueryDto, UpdateIssueDto } from './dto';

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly projects: ProjectsService,
  ) {}
  async list(user: RequestUser, query: IssueListQueryDto) {
    if (query.projectId) await this.scope.assert(user, query.projectId);
    const where: Prisma.IssueWhereInput = {
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
      ...(query.type ? { type: query.type } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.issue.findMany({
        where,
        include: {
          project: { select: { id: true, code: true, name: true } },
          owner: { select: { id: true, displayName: true } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.issue.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }
  async get(user: RequestUser, id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: { project: true, owner: { select: { id: true, displayName: true } } },
    });
    if (!issue) throw this.notFound();
    await this.scope.assert(user, issue.projectId);
    return issue;
  }
  async create(user: RequestUser, dto: CreateIssueDto) {
    await this.scope.assert(user, dto.projectId);
    await this.validateOwner(dto.projectId, dto.ownerUserId);
    const riskScore =
      dto.probability && dto.impact ? calculateRiskScore(dto.probability, dto.impact) : undefined;
    const issue = await this.prisma.$transaction(async (tx) => {
      await assertProjectWritable(tx, dto.projectId);
      return tx.issue.create({
        data: {
          ...dto,
          title: dto.title.trim(),
          riskScore,
          sourceType: dto.sourceType ?? 'MANUAL',
          createdById: user.id,
        },
      });
    });
    await this.projects.recomputeHealth(dto.projectId);
    return issue;
  }
  async update(user: RequestUser, id: string, dto: UpdateIssueDto) {
    const existing = await this.get(user, id);
    await this.validateOwner(existing.projectId, dto.ownerUserId);
    const probability = dto.probability ?? existing.probability;
    const impact = dto.impact ?? existing.impact;
    const riskScore =
      probability && impact ? calculateRiskScore(probability, impact) : existing.riskScore;
    const resolved = dto.status
      ? ['RESOLVED', 'CLOSED'].includes(dto.status)
      : ['RESOLVED', 'CLOSED'].includes(existing.status);
    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        ...dto,
        riskScore,
        resolvedAt: resolved ? (existing.resolvedAt ?? new Date()) : null,
      },
    });
    await this.projects.recomputeHealth(existing.projectId);
    return issue;
  }
  private async validateOwner(projectId: string, ownerUserId?: string) {
    if (!ownerUserId) return;
    const count = await this.prisma.projectMember.count({
      where: { projectId, userId: ownerUserId },
    });
    if (!count)
      throw new BadRequestException({
        code: 'ISSUE_OWNER_INVALID',
        message: '问题负责人必须是项目成员',
      });
  }
  private notFound() {
    return new NotFoundException({ code: 'ISSUE_NOT_FOUND', message: '问题或风险不存在' });
  }
}

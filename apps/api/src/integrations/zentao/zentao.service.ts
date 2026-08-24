import { ConflictException, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../common/types';
import { ProjectScopeService } from '../../auth/project-scope.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ZentaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}

  status() {
    return { status: 'NOT_CONFIGURED', configured: false };
  }

  async syncTask(user: RequestUser, taskId: string): Promise<never> {
    const task = await this.prisma.projectWorkItem.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (task) await this.scope.assert(user, task.projectId);
    throw new ConflictException({
      code: 'ZENTAO_NOT_ENABLED',
      message: '禅道集成当前仅预留接口，尚未启用任务同步实现',
    });
  }

  async list(user: RequestUser) {
    return this.prisma.zentaoTaskSync.findMany({
      where: { workItem: { project: this.scope.where(user) } },
      include: { workItem: { include: { project: { select: { id: true, name: true } } } } },
      orderBy: { lastSyncedAt: 'desc' },
    });
  }
}

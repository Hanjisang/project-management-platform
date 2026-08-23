import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '../../common/types';
import { ProjectScopeService } from '../../auth/project-scope.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZentaoClient } from './zentao.client';
import { ZentaoMapper } from './zentao.mapper';

@Injectable()
export class ZentaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
    private readonly client: ZentaoClient,
    private readonly mapper: ZentaoMapper,
  ) {}
  status() {
    return {
      status: this.client.configured() ? 'CONFIGURED' : 'NOT_CONFIGURED',
      configured: this.client.configured(),
    };
  }
  async syncTask(user: RequestUser, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { zentaoSync: true },
    });
    if (!task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: '任务不存在' });
    await this.scope.assert(user, task.projectId);
    if (task.zentaoSync?.syncStatus === 'SUCCEEDED' && task.zentaoSync.externalTaskId)
      return task.zentaoSync;
    const idempotencyKey =
      task.zentaoSync?.idempotencyKey ??
      createHash('sha256').update(`zentao:${task.id}`).digest('hex');
    await this.prisma.zentaoTaskSync.upsert({
      where: { taskId },
      create: { taskId, idempotencyKey },
      update: { syncStatus: 'PENDING', lastError: null },
    });
    try {
      const externalTaskId = await this.client.createTask(
        this.mapper.toExternal(task),
        idempotencyKey,
      );
      return this.prisma.zentaoTaskSync.update({
        where: { taskId },
        data: {
          externalTaskId,
          syncStatus: 'SUCCEEDED',
          lastSyncedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await this.prisma.zentaoTaskSync.update({
        where: { taskId },
        data: {
          syncStatus: 'FAILED',
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
  async list(user: RequestUser) {
    return this.prisma.zentaoTaskSync.findMany({
      where: { task: { project: this.scope.where(user) } },
      include: { task: { include: { project: { select: { id: true, name: true } } } } },
      orderBy: { lastSyncedAt: 'desc' },
    });
  }
}

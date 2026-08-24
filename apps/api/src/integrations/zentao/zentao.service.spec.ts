import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../../common/types';
import type { ProjectScopeService } from '../../auth/project-scope.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ZentaoClient } from './zentao.client';
import { ZentaoMapper } from './zentao.mapper';
import { ZentaoService } from './zentao.service';

const user: RequestUser = {
  id: 'user-id',
  username: 'user',
  displayName: 'User',
  permissions: [],
  isAdministrator: false,
};
const task = {
  id: 'task-id',
  projectId: 'project-id',
  name: '同步任务',
  description: '任务说明',
  priority: 'HIGH',
  plannedEndDate: new Date('2026-09-01'),
  zentaoSync: null,
};

function fixture(createTask: ReturnType<typeof vi.fn>) {
  const update = vi
    .fn()
    .mockImplementation(({ data }) => Promise.resolve({ workItemId: task.id, ...data }));
  const prisma = {
    projectWorkItem: { findUnique: vi.fn().mockResolvedValue(task) },
    zentaoTaskSync: { upsert: vi.fn().mockResolvedValue({}), update },
  } as unknown as PrismaService;
  const scope = { assert: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectScopeService;
  const client = {
    createTask,
    configured: vi.fn().mockReturnValue(true),
  } as unknown as ZentaoClient;
  return { service: new ZentaoService(prisma, scope, client, new ZentaoMapper()), update };
}

describe('ZentaoService', () => {
  it('maps a task through a fake client and stores a successful sync result', async () => {
    const createTask = vi.fn().mockResolvedValue('ZT-100');
    const { service } = fixture(createTask);
    const result = await service.syncTask(user, task.id);
    expect(createTask).toHaveBeenCalledWith(
      { name: '同步任务', desc: '任务说明', pri: 2, estimate: 1, deadline: '2026-09-01' },
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(result).toMatchObject({ syncStatus: 'SUCCEEDED', externalTaskId: 'ZT-100' });
  });

  it('stores FAILED and an actionable error for a retryable later invocation', async () => {
    const { service, update } = fixture(vi.fn().mockRejectedValue(new Error('gateway timeout')));
    await expect(service.syncTask(user, task.id)).rejects.toThrow('gateway timeout');
    expect(update).toHaveBeenLastCalledWith({
      where: { workItemId: task.id },
      data: { syncStatus: 'FAILED', lastError: 'gateway timeout' },
    });
  });
});

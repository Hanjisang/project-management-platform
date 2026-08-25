import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../../common/types';
import type { ProjectScopeService } from '../../auth/project-scope.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { ZentaoService } from './zentao.service';

const user: RequestUser = {
  id: 'user-id',
  username: 'user',
  displayName: 'User',
  permissions: [],
  isAdministrator: false,
};

function fixture(projectId: string | null = 'project-id') {
  const prisma = {
    projectWorkItem: {
      findUnique: vi.fn().mockResolvedValue(projectId ? { projectId } : null),
    },
    zentaoTaskSync: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const assertScope = vi.fn().mockResolvedValue(undefined);
  const scope = {
    assert: assertScope,
    where: vi.fn().mockReturnValue({ id: 'project-id' }),
  } as unknown as ProjectScopeService;
  return { service: new ZentaoService(prisma, scope), assertScope };
}

describe('ZentaoService reserved integration', () => {
  it('always reports NOT_CONFIGURED while implementation is reserved', () => {
    expect(fixture().service.status()).toEqual({ status: 'NOT_CONFIGURED', configured: false });
  });

  it('checks project scope then rejects synchronization without external calls', async () => {
    const { service, assertScope } = fixture();
    await expect(service.syncTask(user, 'task-id')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ZENTAO_NOT_ENABLED' }),
    });
    expect(assertScope).toHaveBeenCalledWith(user, 'project-id');
  });
});

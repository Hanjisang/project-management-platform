import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../common/types';
import type { PrismaService } from '../prisma/prisma.service';
import { ProjectScopeService } from './project-scope.service';

const member = {
  id: 'user-a',
  username: 'user-a',
  displayName: 'User A',
  permissions: [],
  isAdministrator: false,
} satisfies RequestUser;

describe('ProjectScopeService', () => {
  it('always excludes soft-deleted projects and scopes members', () => {
    const service = new ProjectScopeService({} as PrismaService);
    expect(service.where(member)).toEqual({
      deletedAt: null,
      members: { some: { userId: 'user-a' } },
    });
    expect(service.where({ ...member, isAdministrator: true })).toEqual({ deletedAt: null });
  });

  it('rejects non-members and even administrators cannot access deleted projects', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const service = new ProjectScopeService({ project: { count } } as unknown as PrismaService);
    await expect(service.assert(member, 'project-b')).rejects.toBeInstanceOf(ForbiddenException);
    expect(count).toHaveBeenCalledWith({
      where: {
        id: 'project-b',
        deletedAt: null,
        members: { some: { userId: 'user-a' } },
      },
    });

    await expect(
      service.assert({ ...member, isAdministrator: true }, 'deleted-project'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(count).toHaveBeenLastCalledWith({
      where: { id: 'deleted-project', deletedAt: null },
    });
  });
});

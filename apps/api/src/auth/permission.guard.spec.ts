import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from './permission.guard';

function context(user: { isAdministrator: boolean; permissions: string[] }): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  it('allows a user only when every required permission is present', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['project.view', 'project.edit']),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    expect(
      guard.canActivate(
        context({ isAdministrator: false, permissions: ['project.view', 'project.edit'] }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(context({ isAdministrator: false, permissions: ['project.view'] })),
    ).toThrow(ForbiddenException);
  });

  it('allows administrators without expanding stored permission lists', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['role.manage']),
    } as unknown as Reflector;
    expect(
      new PermissionGuard(reflector).canActivate(
        context({ isAdministrator: true, permissions: [] }),
      ),
    ).toBe(true);
  });

  it('supports explicit OR permissions for option endpoints', () => {
    const reflector = {
      getAllAndOverride: vi
        .fn()
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['project.create', 'project.member.manage']),
    } as unknown as Reflector;
    expect(
      new PermissionGuard(reflector).canActivate(
        context({ isAdministrator: false, permissions: ['project.member.manage'] }),
      ),
    ).toBe(true);
  });
});

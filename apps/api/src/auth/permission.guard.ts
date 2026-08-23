import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../common/decorators';
import type { AuthenticatedRequest } from '../common/types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (
      user.isAdministrator ||
      required.every((permission) => user.permissions.includes(permission))
    )
      return true;
    throw new ForbiddenException({
      code: 'PERMISSION_DENIED',
      message: '无权执行此操作',
      details: { required },
    });
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CSRF_EXEMPT_KEY } from '../common/decorators';
import type { RequestWithId } from '../common/types';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    if (
      this.reflector.getAllAndOverride<boolean>(CSRF_EXEMPT_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const cookieToken = request.cookies?.csrf_token as string | undefined;
    const headerToken = request.header('x-csrf-token');
    if (cookieToken && headerToken && cookieToken === headerToken) return true;
    throw new ForbiddenException({
      code: 'CSRF_TOKEN_INVALID',
      message: '请求安全校验失败，请刷新页面后重试',
    });
  }
}

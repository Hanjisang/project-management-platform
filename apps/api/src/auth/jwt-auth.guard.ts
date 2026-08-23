import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../common/types';
import { IS_PUBLIC_KEY } from '../common/decorators';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: '请先登录' });
    try {
      const payload = await this.auth.verifyAccess(token);
      const user = await this.auth.loadUser(payload.sub);
      if (!user) throw new Error('user inactive');
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'ACCESS_TOKEN_INVALID', message: '登录已过期' });
    }
  }
}

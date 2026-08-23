import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROJECT_ACCESS_KEY } from '../common/decorators';
import type { AuthenticatedRequest } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const parameter = this.reflector.getAllAndOverride<string>(PROJECT_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!parameter) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.isAdministrator) return true;
    const params = request.params as Record<string, string | undefined>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const query = request.query as Record<string, string | undefined>;
    const projectId =
      params[parameter] ??
      (typeof body[parameter] === 'string' ? body[parameter] : undefined) ??
      query[parameter];
    if (!projectId)
      throw new BadRequestException({ code: 'PROJECT_ID_REQUIRED', message: '缺少项目标识' });
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: request.user.id } },
    });
    if (!membership)
      throw new ForbiddenException({ code: 'PROJECT_ACCESS_DENIED', message: '无权访问该项目' });
    return true;
  }
}

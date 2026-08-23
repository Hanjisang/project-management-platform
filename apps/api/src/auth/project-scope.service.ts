import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/types';

@Injectable()
export class ProjectScopeService {
  constructor(private readonly prisma: PrismaService) {}
  where(user: RequestUser): { deletedAt: null; members?: { some: { userId: string } } } {
    return user.isAdministrator
      ? { deletedAt: null }
      : { deletedAt: null, members: { some: { userId: user.id } } };
  }
  async assert(user: RequestUser, projectId: string): Promise<void> {
    const count = await this.prisma.project.count({
      where: {
        id: projectId,
        deletedAt: null,
        ...(user.isAdministrator ? {} : { members: { some: { userId: user.id } } }),
      },
    });
    if (count === 0)
      throw new ForbiddenException({ code: 'PROJECT_ACCESS_DENIED', message: '无权访问该项目' });
  }
}

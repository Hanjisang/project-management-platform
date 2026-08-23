import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/types';

export interface AuditContext {
  user?: RequestUser;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async list(pageValue: string, pageSizeValue: string, resourceType?: string, resourceId?: string) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeValue) || 20));
    const where = {
      ...(resourceType ? { resourceType } : {}),
      ...(resourceId ? { resourceId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }
  async record(
    context: AuditContext,
    action: string,
    resourceType: string,
    resourceId?: string,
    before?: unknown,
    after?: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: context.user?.id,
        action,
        resourceType,
        resourceId,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        before: this.toJson(before),
        after: this.toJson(after),
      },
    });
  }
  private toJson(value: unknown): object | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(
      JSON.stringify(value, (_key, current: unknown) =>
        typeof current === 'bigint' ? current.toString() : current,
      ),
    ) as object;
  }
}

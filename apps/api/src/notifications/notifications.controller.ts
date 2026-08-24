import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';
import { AuditAction, CurrentUser } from '../common/decorators';
import type { RequestUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

class NotificationQueryDto {
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) pageSize = 20;
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@CurrentUser() user: RequestUser, @Query() query: NotificationQueryDto) {
    const [items, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items, unread };
  }
  @Patch(':id/read')
  @AuditAction('notification.read', 'Notification')
  async read(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const item = await this.prisma.notification.findFirst({ where: { id, userId: user.id } });
    if (!item) return null;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: item.readAt ?? new Date() },
    });
  }
}

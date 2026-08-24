import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  findRoleIds(codes: string[]) {
    return this.prisma.role.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
  }
  findForAdministratorProtection(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { status: true, roles: { select: { role: { select: { code: true } } } } },
    });
  }
  create(data: {
    username: string;
    passwordHash: string;
    displayName: string;
    email?: string;
    roleIds: string[];
  }) {
    return this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        email: data.email,
        roles: { create: data.roleIds.map((roleId) => ({ roleId })) },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        status: true,
        roles: { select: { role: { select: { code: true, name: true } } } },
      },
    });
  }
  update(
    id: string,
    data: {
      displayName?: string;
      email?: string;
      status?: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'DEPARTED';
      roleIds?: string[];
    },
    protectLastAdministrator = false,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (protectLastAdministrator) {
        const activeAdministrators = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT u.id
          FROM users u
          INNER JOIN user_roles ur ON ur.user_id = u.id
          INNER JOIN roles r ON r.id = ur.role_id
          WHERE r.code = 'ADMINISTRATOR' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
          FOR UPDATE
        `);
        if (activeAdministrators.length <= 1)
          throw new BadRequestException({
            code: 'LAST_ADMINISTRATOR_REQUIRED',
            message: '系统必须保留至少一个启用的管理员',
          });
      }
      if (data.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: data.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
      return tx.user.update({
        where: { id },
        data: { displayName: data.displayName, email: data.email, status: data.status },
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          status: true,
          roles: { select: { role: { select: { code: true, name: true } } } },
        },
      });
    });
  }
}

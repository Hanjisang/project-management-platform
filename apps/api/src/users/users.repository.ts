import { Injectable } from '@nestjs/common';
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
  ) {
    return this.prisma.$transaction(async (tx) => {
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

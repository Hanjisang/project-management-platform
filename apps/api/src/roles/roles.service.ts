import { BadRequestException, Injectable } from '@nestjs/common';
import { ALL_PERMISSIONS } from '@pmp/shared-constants';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ system: 'desc' }, { name: 'asc' }],
    });
  }
  permissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }
  async create(dto: CreateRoleDto) {
    const permissions = await this.resolvePermissions(dto.permissionCodes);
    return this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name.trim(),
        description: dto.description,
        permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }
  async update(id: string, dto: UpdateRoleDto) {
    const permissions = dto.permissionCodes
      ? await this.resolvePermissions(dto.permissionCodes)
      : undefined;
    return this.prisma.$transaction(async (tx) => {
      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })),
        });
      }
      return tx.role.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }
  private async resolvePermissions(codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    if (
      uniqueCodes.some(
        (code) => !ALL_PERMISSIONS.includes(code as (typeof ALL_PERMISSIONS)[number]),
      )
    )
      throw new BadRequestException({ code: 'PERMISSION_INVALID', message: '存在未定义的权限码' });
    return this.prisma.permission.findMany({ where: { code: { in: uniqueCodes } } });
  }
}

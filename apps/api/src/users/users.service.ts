import { BadRequestException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UsersRepository } from './users.repository';
import type { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
  list() {
    return this.repository.list();
  }
  async create(dto: CreateUserDto) {
    const roles = await this.resolveRoles(dto.roleCodes);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.repository.create({
      username: dto.username.trim(),
      passwordHash,
      displayName: dto.displayName.trim(),
      email: dto.email,
      roleIds: roles.map((role) => role.id),
    });
  }
  async update(id: string, dto: UpdateUserDto) {
    const roles = dto.roleCodes ? await this.resolveRoles(dto.roleCodes) : undefined;
    const existing = await this.repository.findForAdministratorProtection(id);
    const isActiveAdministrator =
      existing?.status === 'ACTIVE' &&
      existing.roles.some((assignment) => assignment.role.code === 'ADMINISTRATOR');
    const removesAdministrator =
      dto.roleCodes !== undefined && !dto.roleCodes.includes('ADMINISTRATOR');
    const disablesAdministrator = dto.status !== undefined && dto.status !== 'ACTIVE';
    return this.repository.update(
      id,
      {
        displayName: dto.displayName?.trim(),
        email: dto.email,
        status: dto.status,
        roleIds: roles?.map((role) => role.id),
      },
      Boolean(isActiveAdministrator && (removesAdministrator || disablesAdministrator)),
    );
  }
  private async resolveRoles(codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length === 0)
      throw new BadRequestException({ code: 'ROLE_REQUIRED', message: '至少选择一个角色' });
    const roles = await this.repository.findRoleIds(uniqueCodes);
    if (roles.length !== uniqueCodes.length)
      throw new BadRequestException({ code: 'ROLE_NOT_FOUND', message: '存在无效角色' });
    return roles;
  }
}

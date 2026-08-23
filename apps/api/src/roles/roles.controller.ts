import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import { AuditAction, RequirePermissions } from '../common/decorators';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@Controller('roles')
@RequirePermissions(PERMISSIONS.ROLE_MANAGE)
export class RolesController {
  constructor(private readonly service: RolesService) {}
  @Get() list() {
    return this.service.list();
  }
  @Get('permissions') permissions() {
    return this.service.permissions();
  }
  @Post() @AuditAction('role.create', 'Role') create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }
  @Patch(':id') @AuditAction('role.update', 'Role') update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.update(id, dto);
  }
}

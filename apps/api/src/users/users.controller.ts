import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import { AuditAction, RequirePermissions } from '../common/decorators';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@RequirePermissions(PERMISSIONS.USER_MANAGE)
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get() list() {
    return this.service.list();
  }
  @Post() @AuditAction('user.create', 'User') create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }
  @Patch(':id') @AuditAction('user.update', 'User') update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.service.update(id, dto);
  }
}

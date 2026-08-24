import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  AuditAction,
  CurrentUser,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}
  @Get() @RequirePermissions(PERMISSIONS.TASK_VIEW) list(
    @CurrentUser() user: RequestUser,
    @Query() query: TaskListQueryDto,
  ) {
    return this.service.list(user, query);
  }
  @Get(':id') @RequirePermissions(PERMISSIONS.TASK_VIEW) get(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.get(user, id);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.TASK_CREATE)
  @RequireProjectAccess()
  @AuditAction('task.create', 'Task')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTaskDto) {
    return this.service.create(user, dto);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASK_EDIT)
  @AuditAction('task.update', 'Task')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.service.update(user, id, dto);
  }
  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.TASK_COMPLETE)
  @AuditAction('task.complete', 'Task')
  complete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.complete(user, id);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TASK_EDIT)
  @AuditAction('task.delete', 'Task')
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}

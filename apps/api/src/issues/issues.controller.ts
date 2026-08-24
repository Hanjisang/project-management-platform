import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  AuditAction,
  CurrentUser,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import { CreateIssueDto, IssueListQueryDto, UpdateIssueDto } from './dto';
import { IssuesService } from './issues.service';

@ApiTags('Issues')
@Controller('issues')
export class IssuesController {
  constructor(private readonly service: IssuesService) {}
  @Get() @RequirePermissions(PERMISSIONS.ISSUE_VIEW) list(
    @CurrentUser() user: RequestUser,
    @Query() query: IssueListQueryDto,
  ) {
    return this.service.list(user, query);
  }
  @Get(':id') @RequirePermissions(PERMISSIONS.ISSUE_VIEW) get(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.get(user, id);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.ISSUE_CREATE)
  @RequireProjectAccess()
  @AuditAction('issue.create', 'Issue')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateIssueDto) {
    return this.service.create(user, dto);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ISSUE_EDIT)
  @AuditAction('issue.update', 'Issue')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateIssueDto) {
    return this.service.update(user, id, dto);
  }
  @Post(':id/resolve')
  @RequirePermissions(PERMISSIONS.ISSUE_EDIT)
  @AuditAction('issue.resolve', 'Issue')
  resolve(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.resolve(user, id);
  }
  @Post(':id/close')
  @RequirePermissions(PERMISSIONS.ISSUE_CLOSE)
  @AuditAction('issue.close', 'Issue')
  close(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.close(user, id);
  }
}

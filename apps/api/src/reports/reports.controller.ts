import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import {
  AuditAction,
  CurrentUser,
  RequirePermissions,
  RequireProjectAccess,
} from '../common/decorators';
import type { RequestUser } from '../common/types';
import { GenerateWeeklyReportDto, UpsertDailyReportDto } from './dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('daily') @RequirePermissions(PERMISSIONS.REPORT_VIEW) daily(
    @CurrentUser() user: RequestUser,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.dailyList(user, projectId, from, to);
  }
  @Post('daily')
  @RequirePermissions(PERMISSIONS.REPORT_SUBMIT)
  @RequireProjectAccess()
  @AuditAction('daily-report.submit', 'DailyReport')
  upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertDailyReportDto) {
    return this.service.upsertDaily(user, dto);
  }
  @Get('weekly') @RequirePermissions(PERMISSIONS.REPORT_VIEW) weekly(
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.listWeekly(user);
  }
  @Post('weekly/generate')
  @RequirePermissions(PERMISSIONS.REPORT_SUBMIT)
  @AuditAction('weekly-report.generate', 'WeeklyReport')
  generate(@CurrentUser() user: RequestUser, @Body() dto: GenerateWeeklyReportDto) {
    return this.service.generateWeekly(user, dto);
  }
}

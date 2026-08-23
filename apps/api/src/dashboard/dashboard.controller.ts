import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser } from '../common/types';
import { DashboardService } from './dashboard.service';
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get() @RequirePermissions(PERMISSIONS.PROJECT_VIEW) get(@CurrentUser() user: RequestUser) {
    return this.service.overview(user);
  }
}

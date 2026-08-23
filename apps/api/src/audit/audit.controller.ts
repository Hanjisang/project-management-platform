import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@pmp/shared-constants';
import { RequirePermissions } from '../common/decorators';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('audit')
@RequirePermissions(PERMISSIONS.AUDIT_VIEW)
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get()
  list(
    @Query('page') pageValue = '1',
    @Query('pageSize') pageSizeValue = '20',
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.service.list(pageValue, pageSizeValue, resourceType, resourceId);
  }
}

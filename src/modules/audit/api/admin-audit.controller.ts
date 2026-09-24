import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditService } from '../audit.service';
import { AuditPaginatedQueryDto } from '../dto/audit-query.dto';
import { RequirePermissions } from '@/common/guards/permissions.guard';

@ApiTags('Admin - Audit Logs')
@Controller('admin/audit-logs')
@RequirePermissions('system.logs')
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated audit logs' })
  async findAll(@Query() query: AuditPaginatedQueryDto) {
    return this.auditService.findPaginated(
      {
        actorId: query.actorId,
        action: query.action,
        targetType: query.targetType,
        targetId: query.targetId,
      },
      { page: query.page ?? 1, limit: query.limit ?? 20 },
    );
  }
}

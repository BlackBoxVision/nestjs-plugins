import {
  Controller,
  Get,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_MODULE_OPTIONS, AuditLogModuleOptions } from './interfaces';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
    @Inject(AUDIT_LOG_MODULE_OPTIONS)
    private readonly options: AuditLogModuleOptions,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs', description: 'Retrieve a paginated list of audit log entries with optional filters' })
  @ApiResponse({ status: 200, description: 'Audit log entries retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll({
      userId: query.userId,
      entity: query.entity,
      entityId: query.entityId,
      action: query.action,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: query.page + 1,
      limit: query.limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID', description: 'Retrieve a single audit log entry by its ID' })
  @ApiParam({ name: 'id', description: 'Audit log entry ID' })
  @ApiResponse({ status: 200, description: 'Audit log entry retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Audit log entry not found' })
  async findById(@Param('id') id: string) {
    return this.auditLogService.findById(id);
  }

  @Get('entity/:entity/:entityId')
  @ApiOperation({ summary: 'Get audit logs by entity', description: 'Retrieve all audit log entries for a specific entity' })
  @ApiParam({ name: 'entity', description: 'Entity type (e.g., User, Order)' })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  @ApiResponse({ status: 200, description: 'Audit log entries retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.findByEntity(entity, entityId);
  }
}

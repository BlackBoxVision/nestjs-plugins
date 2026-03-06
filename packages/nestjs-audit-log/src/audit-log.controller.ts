import {
  Controller,
  Get,
  Param,
  Query,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_MODULE_OPTIONS, AuditLogModuleOptions } from './interfaces';

@Controller('audit-logs')
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
    @Inject(AUDIT_LOG_MODULE_OPTIONS)
    private readonly options: AuditLogModuleOptions,
  ) {}

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findAll({
      userId,
      entity,
      entityId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.auditLogService.findById(id);
  }

  @Get('entity/:entity/:entityId')
  async findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.findByEntity(entity, entityId);
  }
}

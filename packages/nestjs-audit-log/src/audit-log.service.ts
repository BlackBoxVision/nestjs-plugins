import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import {
  AuditLogEntry,
  AuditLogModuleOptions,
  AuditLogQueryOptions,
  AUDIT_LOG_MODULE_OPTIONS,
} from './interfaces';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: any,
    @Inject(AUDIT_LOG_MODULE_OPTIONS)
    private readonly options: AuditLogModuleOptions,
  ) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity ?? null,
          entityId: entry.entityId ?? null,
          changes: entry.changes ?? null,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create audit log entry: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  async findAll(queryOptions: AuditLogQueryOptions = {}) {
    const {
      userId,
      entity,
      entityId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = queryOptions;

    const where: Record<string, unknown> = {};

    if (userId) {
      where['userId'] = userId;
    }

    if (entity) {
      where['entity'] = entity;
    }

    if (entityId) {
      where['entityId'] = entityId;
    }

    if (action) {
      where['action'] = action;
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) {
        createdAt['gte'] = startDate;
      }
      if (endDate) {
        createdAt['lte'] = endDate;
      }
      where['createdAt'] = createdAt;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    return this.prisma.auditLog.findUnique({ where: { id } });
  }

  async findByEntity(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findByUser(userId: string, queryOptions: AuditLogQueryOptions = {}) {
    return this.findAll({ ...queryOptions, userId });
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} audit log entries older than ${olderThanDays} days`,
    );

    return result.count;
  }
}

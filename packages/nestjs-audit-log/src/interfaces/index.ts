export interface AuditLogModuleOptions {
  features?: {
    autoTrackCrud?: boolean;
    trackAuthEvents?: boolean;
    trackChanges?: boolean;
    registerController?: boolean;
    retention?: number | null;
  };
  excludeEntities?: string[];
  excludeFields?: string[];
  adminRoles?: string[];
}

export interface AuditLogModuleAsyncOptions {
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<AuditLogModuleOptions> | AuditLogModuleOptions;
  inject?: any[];
}

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQueryOptions {
  userId?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export const AUDIT_LOG_MODULE_OPTIONS = 'AUDIT_LOG_MODULE_OPTIONS';

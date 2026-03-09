import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import { AuditLogService } from './audit-log.service';
import {
  AuditLogModuleOptions,
  AUDIT_LOG_MODULE_OPTIONS,
} from './interfaces';
import {
  createAuditMiddleware,
  auditContextStorage,
} from './middleware/prisma-audit.middleware';

@Injectable()
export class AuditMiddlewareRegistrar implements OnModuleInit {
  private readonly logger = new Logger(AuditMiddlewareRegistrar.name);

  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: any,
    private readonly auditLogService: AuditLogService,
    @Inject(AUDIT_LOG_MODULE_OPTIONS)
    private readonly options: AuditLogModuleOptions,
  ) {}

  onModuleInit(): void {
    if (!this.options.features?.autoTrackCrud) {
      return;
    }

    if (typeof this.prisma.$use === 'function') {
      this.prisma.$use(
        createAuditMiddleware(this.auditLogService, this.options),
      );
      return;
    }

    this.wrapModelOperations();
  }

  /**
   * For Prisma 6+ where $use is removed, directly wrap create/update/delete
   * methods on each model delegate to capture operations for audit logging.
   */
  private wrapModelOperations(): void {
    const excludeEntities = new Set(
      (this.options.excludeEntities ?? []).map((e) => e.toLowerCase()),
    );
    excludeEntities.add('auditlog');

    const excludeFields = new Set(
      this.options.excludeFields ?? ['password', 'hash', 'token', 'secret'],
    );

    const auditLogService = this.auditLogService;
    const trackChanges = this.options.features?.trackChanges ?? false;
    const prisma = this.prisma;

    const modelNames = this.discoverModelNames(prisma);

    for (const modelName of modelNames) {
      if (excludeEntities.has(modelName.toLowerCase())) {
        continue;
      }

      const delegate = prisma[modelName];
      if (!delegate) {
        continue;
      }

      // Prisma model names in $use middleware are PascalCase (e.g. "Item"),
      // but delegate property names are camelCase (e.g. "item").
      const entityName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

      this.wrapMethod(delegate, entityName, 'create', async (args: any, result: any) => {
        const context = auditContextStorage.getStore();
        await auditLogService.log({
          userId: context?.userId,
          action: 'CREATE',
          entity: entityName,
          entityId: result?.id?.toString(),
          metadata: sanitizeData(args?.data, excludeFields),
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      });

      this.wrapMethod(delegate, entityName, 'update', async (args: any, result: any) => {
        const context = auditContextStorage.getStore();
        if (trackChanges) {
          const changes: Record<string, { old: unknown; new: unknown }> = {};
          const updateData = args?.data ?? {};
          for (const [key, newValue] of Object.entries(updateData)) {
            if (excludeFields.has(key)) continue;
            if (newValue !== undefined) {
              changes[key] = { old: null, new: newValue };
            }
          }
          await auditLogService.log({
            userId: context?.userId,
            action: 'UPDATE',
            entity: entityName,
            entityId: result?.id?.toString(),
            changes: Object.keys(changes).length > 0 ? changes : undefined,
            ipAddress: context?.ipAddress,
            userAgent: context?.userAgent,
          });
        } else {
          await auditLogService.log({
            userId: context?.userId,
            action: 'UPDATE',
            entity: entityName,
            entityId: result?.id?.toString(),
            ipAddress: context?.ipAddress,
            userAgent: context?.userAgent,
          });
        }
      });

      this.wrapMethod(delegate, entityName, 'delete', async (args: any, result: any) => {
        const context = auditContextStorage.getStore();
        await auditLogService.log({
          userId: context?.userId,
          action: 'DELETE',
          entity: entityName,
          entityId: result?.id?.toString(),
          metadata: sanitizeData(result, excludeFields),
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      });
    }

    this.logger.log(
      `Audit CRUD tracking registered for ${modelNames.length} models (Prisma 6+ direct wrapping)`,
    );
  }

  /**
   * Wraps a single method on a model delegate with an audit callback.
   * The original method is called first, then the audit callback runs.
   * Audit errors are silently caught to avoid breaking application logic.
   */
  private wrapMethod(
    delegate: any,
    modelName: string,
    method: string,
    afterCallback: (args: any, result: any) => Promise<void>,
  ): void {
    const original = delegate[method];
    if (typeof original !== 'function') {
      return;
    }

    delegate[method] = function auditWrapped(this: any, ...callArgs: any[]) {
      const prismaPromise = original.apply(this, callArgs);
      // Override .then() to inject audit logging while preserving PrismaPromise internals.
      // This keeps $transaction compatibility since internal query data remains on the object.
      const origThen = prismaPromise.then.bind(prismaPromise);
      prismaPromise.then = function (onFulfilled?: any, onRejected?: any) {
        return origThen(async (result: any) => {
          try {
            await afterCallback(callArgs[0], result);
          } catch {
            // Audit logging failure must not break application operations
          }
          return onFulfilled ? onFulfilled(result) : result;
        }, onRejected);
      };
      return prismaPromise;
    };
  }

  /**
   * Discovers Prisma model names by looking for properties that have
   * standard Prisma model delegate methods (create, findMany, etc).
   */
  private discoverModelNames(prisma: any): string[] {
    const models: string[] = [];

    // Get all own property names from the instance and its prototype chain
    const allKeys = new Set<string>();
    let obj = prisma;
    while (obj && obj !== Object.prototype) {
      for (const key of Object.getOwnPropertyNames(obj)) {
        allKeys.add(key);
      }
      obj = Object.getPrototypeOf(obj);
    }

    for (const key of allKeys) {
      if (key.startsWith('$') || key.startsWith('_')) {
        continue;
      }

      // Prisma 6 exposes both PascalCase and camelCase model accessors.
      // Only wrap camelCase to avoid double-wrapping (they are separate objects).
      if (key.charAt(0) === key.charAt(0).toUpperCase()) {
        continue;
      }

      try {
        const value = prisma[key];
        if (
          value &&
          typeof value === 'object' &&
          typeof value.create === 'function' &&
          typeof value.findMany === 'function'
        ) {
          models.push(key);
        }
      } catch {
        // Skip properties that throw on access
      }
    }

    return models;
  }
}

function sanitizeData(
  data: Record<string, unknown> | undefined | null,
  excludeFields: Set<string>,
): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = excludeFields.has(key) ? '[REDACTED]' : value;
  }
  return sanitized;
}

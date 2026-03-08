import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AuditLogService } from '../audit-log.service';
import { AuditLogModuleOptions } from '../interfaces';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const auditContextStorage = new AsyncLocalStorage<AuditContext>();

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void): void {
    const context: AuditContext = {
      userId: req.user?.id ?? req.user?.sub ?? undefined,
      ipAddress:
        (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
        req.ip ??
        req.socket?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };

    auditContextStorage.run(context, () => {
      next();
    });
  }
}

export function createAuditMiddleware(
  auditLogService: AuditLogService,
  options: AuditLogModuleOptions,
) {
  const excludeEntities = new Set(
    (options.excludeEntities ?? []).map((e) => e.toLowerCase()),
  );
  const excludeFields = new Set(options.excludeFields ?? ['password', 'hash', 'token', 'secret']);

  return async (params: any, next: (params: any) => Promise<any>) => {
    const model: string | undefined = params.model;
    const action: string = params.action;

    if (!model) {
      return next(params);
    }

    const trackedActions = ['create', 'update', 'delete'];
    if (!trackedActions.includes(action)) {
      return next(params);
    }

    if (excludeEntities.has(model.toLowerCase())) {
      return next(params);
    }

    const context = auditContextStorage.getStore();

    if (action === 'update' && options.features?.trackChanges) {
      return handleUpdate(
        params,
        next,
        auditLogService,
        model,
        context,
        excludeFields,
      );
    }

    const result = await next(params);

    if (action === 'create') {
      const sanitizedData = sanitizeData(params.args?.data, excludeFields);

      await auditLogService.log({
        userId: context?.userId,
        action: 'CREATE',
        entity: model,
        entityId: result?.id?.toString(),
        metadata: sanitizedData,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    }

    if (action === 'delete') {
      await auditLogService.log({
        userId: context?.userId,
        action: 'DELETE',
        entity: model,
        entityId: result?.id?.toString(),
        metadata: sanitizeData(result, excludeFields),
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    }

    return result;
  };
}

/**
 * Handles UPDATE audit logging.
 *
 * TODO: Change tracking (old vs new values) requires a reference to the Prisma client
 * instance to fetch the record before the update. The Prisma middleware `params` object
 * does not expose the client, so `old` values are not available. Currently, only the
 * new values from the update data are logged. To enable full change tracking, the
 * consuming application would need to pass the Prisma client into the audit middleware
 * factory, or use Prisma's `$extends` client extension API instead of middleware.
 */
async function handleUpdate(
  params: any,
  next: (params: any) => Promise<any>,
  auditLogService: AuditLogService,
  model: string,
  context: AuditContext | undefined,
  excludeFields: Set<string>,
): Promise<any> {
  const result = await next(params);

  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const updateData = params.args?.data ?? {};

  for (const [key, newValue] of Object.entries(updateData)) {
    if (excludeFields.has(key)) {
      continue;
    }

    if (newValue !== undefined) {
      changes[key] = {
        old: null,
        new: newValue,
      };
    }
  }

  await auditLogService.log({
    userId: context?.userId,
    action: 'UPDATE',
    entity: model,
    entityId: result?.id?.toString(),
    changes: Object.keys(changes).length > 0 ? changes : undefined,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return result;
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
    if (excludeFields.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

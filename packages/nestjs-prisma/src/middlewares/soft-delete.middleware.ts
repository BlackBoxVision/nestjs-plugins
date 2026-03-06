import { Prisma } from '@prisma/client';

/**
 * Prisma middleware that intercepts delete operations and converts them to
 * soft deletes by setting a `deletedAt` timestamp. It also filters out
 * soft-deleted records from find queries automatically.
 *
 * Usage:
 * ```ts
 * const prisma = new PrismaClient();
 * prisma.$use(softDeleteMiddleware());
 * ```
 *
 * Models that use soft delete must have a `deletedAt DateTime?` field.
 */
export function softDeleteMiddleware(): Prisma.Middleware {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
  ) => {
    // Convert delete to soft delete (update with deletedAt)
    if (params.action === 'delete') {
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };
      return next(params);
    }

    // Convert deleteMany to soft delete (updateMany with deletedAt)
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args['data'] !== undefined) {
        params.args['data']['deletedAt'] = new Date();
      } else {
        params.args['data'] = { deletedAt: new Date() };
      }
      return next(params);
    }

    // Filter out soft-deleted records from find operations
    if (
      params.action === 'findFirst' ||
      params.action === 'findMany' ||
      params.action === 'findUnique'
    ) {
      if (params.args['where'] !== undefined) {
        // Only add deletedAt filter if not explicitly querying for deleted records
        if (params.args['where']['deletedAt'] === undefined) {
          params.args['where']['deletedAt'] = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
      return next(params);
    }

    // Filter out soft-deleted records from count operations
    if (params.action === 'count') {
      if (params.args['where'] !== undefined) {
        if (params.args['where']['deletedAt'] === undefined) {
          params.args['where']['deletedAt'] = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
      return next(params);
    }

    return next(params);
  };
}

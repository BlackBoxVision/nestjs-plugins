import { PaginatedApiResponse } from '@bbv/nestjs-response';
import { PaginationDto } from './pagination.dto';

export interface PaginateOptions<TWhereInput> {
  model: {
    findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  pagination: PaginationDto;
  where?: TWhereInput;
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
}

export async function paginate<T, TWhereInput = Record<string, unknown>>(
  options: PaginateOptions<TWhereInput>,
): Promise<PaginatedApiResponse<T>> {
  const { model, pagination, where, orderBy, include, select } = options;

  const resolvedOrderBy = orderBy ?? { [pagination.sortBy]: pagination.sortOrder };

  const findManyArgs: Record<string, unknown> = {
    skip: pagination.skip,
    take: pagination.take,
    orderBy: resolvedOrderBy,
  };

  const countArgs: Record<string, unknown> = {};

  if (where) {
    findManyArgs['where'] = where;
    countArgs['where'] = where;
  }

  if (include) {
    findManyArgs['include'] = include;
  }

  if (select) {
    findManyArgs['select'] = select;
  }

  const [data, total] = await Promise.all([
    model.findMany(findManyArgs),
    model.count(countArgs),
  ]);

  return PaginatedApiResponse.paginated<T>(
    data as T[],
    total,
    pagination.page,
    pagination.limit,
  );
}

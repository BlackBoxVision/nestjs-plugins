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
  searchFields?: string[];
  search?: string;
}

export async function paginate<T, TWhereInput = Record<string, unknown>>(
  options: PaginateOptions<TWhereInput>,
): Promise<PaginatedApiResponse<T>> {
  const { model, pagination, where, orderBy, include, select, searchFields, search } = options;

  const resolvedOrderBy = orderBy ?? { [pagination.sortBy]: pagination.sortOrder };

  let resolvedWhere = where as Record<string, unknown> | undefined;

  if (search && searchFields && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));

    resolvedWhere = resolvedWhere
      ? { AND: [resolvedWhere, { OR: searchConditions }] }
      : ({ OR: searchConditions } as unknown as Record<string, unknown>);
  }

  const findManyArgs: Record<string, unknown> = {
    skip: pagination.skip,
    take: pagination.take,
    orderBy: resolvedOrderBy,
  };

  const countArgs: Record<string, unknown> = {};

  if (resolvedWhere) {
    findManyArgs['where'] = resolvedWhere;
    countArgs['where'] = resolvedWhere;
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

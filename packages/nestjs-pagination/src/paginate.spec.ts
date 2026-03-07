import { paginate } from './paginate';
import { PaginationDto, SortOrder } from './pagination.dto';
import { PaginatedApiResponse } from '@bbv/nestjs-response';

function createMockModel(data: any[] = [], total: number = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(data),
    count: jest.fn().mockResolvedValue(total),
  };
}

function createPaginationDto(page = 0, limit = 10): PaginationDto {
  const dto = new PaginationDto();
  dto.page = page;
  dto.limit = limit;
  return dto;
}

describe('paginate', () => {
  it('should call findMany and count in parallel', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    expect(model.findMany).toHaveBeenCalledTimes(1);
    expect(model.count).toHaveBeenCalledTimes(1);
  });

  it('should apply skip and take correctly from 0-based pagination dto', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto(2, 10);

    await paginate({ model, pagination });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20, // 2 * 10
        take: 10,
      }),
    );
  });

  it('should use default page=0 and limit=10 when not specified', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0, // 0 * 10
        take: 10,
      }),
    );
  });

  it('should auto-build orderBy from pagination sortBy and sortOrder', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();
    pagination.sortBy = 'name';
    pagination.sortOrder = SortOrder.ASC;

    await paginate({ model, pagination });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('should use default sortBy=createdAt and sortOrder=desc', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should use explicit orderBy option over pagination sort fields', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();
    const orderBy = { updatedAt: 'asc' as const };

    await paginate({ model, pagination, orderBy });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: 'asc' },
      }),
    );
  });

  it('should pass where to both findMany and count', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();
    const where = { status: 'active' };

    await paginate({ model, pagination, where });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(model.count).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
  });

  it('should not pass orderBy to count', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    expect(model.count).toHaveBeenCalledWith(
      expect.not.objectContaining({ orderBy: expect.anything() }),
    );
  });

  it('should pass include to findMany only, not to count', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();
    const include = { author: true };

    await paginate({ model, pagination, include });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include }),
    );
    expect(model.count).toHaveBeenCalledWith(
      expect.not.objectContaining({ include }),
    );
  });

  it('should pass select to findMany only, not to count', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();
    const select = { id: true, name: true };

    await paginate({ model, pagination, select });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select }),
    );
    expect(model.count).toHaveBeenCalledWith(
      expect.not.objectContaining({ select }),
    );
  });

  it('should return PaginatedApiResponse with correct data and flat pagination fields', async () => {
    const items = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
    const model = createMockModel(items, 50);
    const pagination = createPaginationDto(1, 10);

    const result = await paginate({ model, pagination });

    expect(result).toBeInstanceOf(PaginatedApiResponse);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(items);
    expect(result.errors).toBeNull();
    expect(result.total).toBe(50);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should return empty data when there are 0 results', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto(0, 10);

    const result = await paginate({ model, pagination });

    expect(result).toBeInstanceOf(PaginatedApiResponse);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(0);
    expect(result.limit).toBe(10);
  });

  it('should pass all combined options correctly', async () => {
    const items = [{ id: 1, title: 'Post 1' }];
    const model = createMockModel(items, 100);
    const pagination = createPaginationDto(1, 5);
    const where = { published: true };
    const orderBy = { createdAt: 'desc' as const };
    const include = { author: true, comments: true };
    const select = { id: true, title: true };

    const result = await paginate({
      model,
      pagination,
      where,
      orderBy,
      include,
      select,
    });

    expect(model.findMany).toHaveBeenCalledWith({
      skip: 5, // 1 * 5
      take: 5,
      where,
      orderBy,
      include,
      select,
    });

    expect(model.count).toHaveBeenCalledWith({ where });

    expect(result.data).toEqual(items);
    expect(result.total).toBe(100);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(5);
  });

  it('should not pass where to findMany or count when not provided', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    const findManyCall = model.findMany.mock.calls[0][0];
    const countCall = model.count.mock.calls[0][0];

    expect(findManyCall).not.toHaveProperty('where');
    expect(countCall).not.toHaveProperty('where');
  });

  it('should not pass include or select when not provided', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    const findManyCall = model.findMany.mock.calls[0][0];

    expect(findManyCall).not.toHaveProperty('include');
    expect(findManyCall).not.toHaveProperty('select');
  });
});

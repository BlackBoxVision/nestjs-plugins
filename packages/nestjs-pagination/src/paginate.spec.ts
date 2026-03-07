import { paginate } from './paginate';
import { PaginationDto } from './pagination.dto';
import { PaginatedResponseDto } from './paginated-response.dto';

function createMockModel(data: any[] = [], total: number = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(data),
    count: jest.fn().mockResolvedValue(total),
  };
}

function createPaginationDto(page = 1, limit = 20): PaginationDto {
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

  it('should apply skip and take correctly from pagination dto', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto(3, 10);

    await paginate({ model, pagination });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20, // (3-1) * 10
        take: 10,
      }),
    );
  });

  it('should use default page=1 and limit=20 when not specified', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0, // (1-1) * 20
        take: 20,
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

  it('should pass orderBy to findMany only, not to count', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();
    const orderBy = { createdAt: 'desc' };

    await paginate({ model, pagination, orderBy });

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy }),
    );
    expect(model.count).toHaveBeenCalledWith(
      expect.not.objectContaining({ orderBy }),
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

  it('should return PaginatedResponseDto with correct data and meta', async () => {
    const items = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
    const model = createMockModel(items, 50);
    const pagination = createPaginationDto(2, 10);

    const result = await paginate({ model, pagination });

    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.data).toEqual(items);
    expect(result.meta.total).toBe(50);
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.totalPages).toBe(5); // ceil(50/10)
  });

  it('should return empty data and totalPages 0 when there are 0 results', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto(1, 10);

    const result = await paginate({ model, pagination });

    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.totalPages).toBe(0);
  });

  it('should calculate totalPages correctly on exact page boundary', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    const model = createMockModel(items, 40);
    const pagination = createPaginationDto(1, 20);

    const result = await paginate({ model, pagination });

    expect(result.meta.total).toBe(40);
    expect(result.meta.limit).toBe(20);
    expect(result.meta.totalPages).toBe(2); // ceil(40/20) = 2
  });

  it('should calculate totalPages correctly when not on exact boundary', async () => {
    const items = [{ id: 1 }];
    const model = createMockModel(items, 41);
    const pagination = createPaginationDto(1, 20);

    const result = await paginate({ model, pagination });

    expect(result.meta.totalPages).toBe(3); // ceil(41/20) = 3
  });

  it('should pass all combined options correctly', async () => {
    const items = [{ id: 1, title: 'Post 1' }];
    const model = createMockModel(items, 100);
    const pagination = createPaginationDto(2, 5);
    const where = { published: true };
    const orderBy = { createdAt: 'desc' };
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

    // findMany receives all options
    expect(model.findMany).toHaveBeenCalledWith({
      skip: 5, // (2-1) * 5
      take: 5,
      where,
      orderBy,
      include,
      select,
    });

    // count receives only where
    expect(model.count).toHaveBeenCalledWith({ where });

    // Response is correct
    expect(result.data).toEqual(items);
    expect(result.meta.total).toBe(100);
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(5);
    expect(result.meta.totalPages).toBe(20); // ceil(100/5)
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

  it('should not pass orderBy, include, or select when not provided', async () => {
    const model = createMockModel([], 0);
    const pagination = createPaginationDto();

    await paginate({ model, pagination });

    const findManyCall = model.findMany.mock.calls[0][0];

    expect(findManyCall).not.toHaveProperty('orderBy');
    expect(findManyCall).not.toHaveProperty('include');
    expect(findManyCall).not.toHaveProperty('select');
  });
});

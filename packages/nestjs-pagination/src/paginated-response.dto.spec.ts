import { PaginatedResponseDto, PaginationMeta } from './paginated-response.dto';

describe('PaginatedResponseDto', () => {
  it('should create paginated response with correct meta', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const response = new PaginatedResponseDto(data, 50, 1, 20);

    expect(response.data).toEqual(data);
    expect(response.meta.total).toBe(50);
    expect(response.meta.page).toBe(1);
    expect(response.meta.limit).toBe(20);
    expect(response.meta.totalPages).toBe(3);
    expect(response.meta.hasPreviousPage).toBe(false);
    expect(response.meta.hasNextPage).toBe(true);
  });

  it('should indicate last page correctly', () => {
    const response = new PaginatedResponseDto([], 50, 3, 20);

    expect(response.meta.hasPreviousPage).toBe(true);
    expect(response.meta.hasNextPage).toBe(false);
  });

  it('should handle single page', () => {
    const response = new PaginatedResponseDto([{ id: '1' }], 1, 1, 20);

    expect(response.meta.totalPages).toBe(1);
    expect(response.meta.hasPreviousPage).toBe(false);
    expect(response.meta.hasNextPage).toBe(false);
  });

  it('should handle empty results', () => {
    const response = new PaginatedResponseDto([], 0, 1, 20);

    expect(response.meta.totalPages).toBe(0);
    expect(response.meta.hasPreviousPage).toBe(false);
    expect(response.meta.hasNextPage).toBe(false);
  });
});

describe('PaginationMeta', () => {
  it('should calculate totalPages correctly', () => {
    const meta = new PaginationMeta(55, 1, 20);
    expect(meta.totalPages).toBe(3);
  });
});

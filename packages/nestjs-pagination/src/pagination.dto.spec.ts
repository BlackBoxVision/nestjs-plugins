import { PaginationDto, SortOrder } from './pagination.dto';

describe('PaginationDto', () => {
  it('should have default values', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(0);
    expect(dto.limit).toBe(10);
    expect(dto.sortBy).toBe('createdAt');
    expect(dto.sortOrder).toBe(SortOrder.DESC);
  });

  it('should calculate skip correctly for 0-based page', () => {
    const dto = new PaginationDto();
    dto.page = 2;
    dto.limit = 10;
    expect(dto.skip).toBe(20);
  });

  it('should return take as limit', () => {
    const dto = new PaginationDto();
    dto.limit = 50;
    expect(dto.take).toBe(50);
  });

  it('should calculate skip as 0 for first page (page=0)', () => {
    const dto = new PaginationDto();
    dto.page = 0;
    dto.limit = 10;
    expect(dto.skip).toBe(0);
  });

  it('should calculate skip correctly for page 1', () => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 10;
    expect(dto.skip).toBe(10);
  });
});

describe('SortOrder', () => {
  it('should have ASC and DESC values', () => {
    expect(SortOrder.ASC).toBe('asc');
    expect(SortOrder.DESC).toBe('desc');
  });
});

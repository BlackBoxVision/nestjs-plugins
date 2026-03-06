import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('should have default values', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('should calculate skip correctly', () => {
    const dto = new PaginationDto();
    dto.page = 3;
    dto.limit = 10;
    expect(dto.skip).toBe(20);
  });

  it('should return take as limit', () => {
    const dto = new PaginationDto();
    dto.limit = 50;
    expect(dto.take).toBe(50);
  });

  it('should calculate skip as 0 for first page', () => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 20;
    expect(dto.skip).toBe(0);
  });
});

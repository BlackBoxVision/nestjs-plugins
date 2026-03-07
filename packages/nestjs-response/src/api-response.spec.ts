import { ApiResponse, PaginatedApiResponse } from './api-response';

describe('ApiResponse', () => {
  it('should create a success response', () => {
    const data = { id: '1', name: 'test' };
    const response = ApiResponse.ok(data);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
    expect(response.errors).toBeNull();
  });

  it('should create an error response', () => {
    const errors = { _general: ['Something failed'] };
    const response = ApiResponse.error(errors);

    expect(response.success).toBe(false);
    expect(response.data).toBeNull();
    expect(response.errors).toEqual(errors);
  });

  it('should create error response with field errors', () => {
    const errors = { email: ['must be a valid email'], name: ['must not be empty'] };
    const response = ApiResponse.error(errors);

    expect(response.success).toBe(false);
    expect(response.data).toBeNull();
    expect(response.errors).toEqual(errors);
  });
});

describe('PaginatedApiResponse', () => {
  it('should create a paginated response', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const response = PaginatedApiResponse.paginated(data, 50, 0, 10);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
    expect(response.errors).toBeNull();
    expect(response.total).toBe(50);
    expect(response.page).toBe(0);
    expect(response.limit).toBe(10);
  });

  it('should be an instance of ApiResponse', () => {
    const response = PaginatedApiResponse.paginated([], 0, 0, 10);

    expect(response).toBeInstanceOf(ApiResponse);
    expect(response).toBeInstanceOf(PaginatedApiResponse);
  });

  it('should handle empty results', () => {
    const response = PaginatedApiResponse.paginated([], 0, 0, 10);

    expect(response.data).toEqual([]);
    expect(response.total).toBe(0);
  });
});

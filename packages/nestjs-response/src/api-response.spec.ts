import { ApiResponse } from './api-response';

describe('ApiResponse', () => {
  it('should create a success response', () => {
    const data = { id: '1', name: 'test' };
    const response = ApiResponse.ok(data, 'Success');

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
    expect(response.message).toBe('Success');
    expect(response.timestamp).toBeDefined();
  });

  it('should create an error response', () => {
    const response = ApiResponse.error('Something failed');

    expect(response.success).toBe(false);
    expect(response.data).toBeNull();
    expect(response.message).toBe('Something failed');
  });

  it('should create error response with data', () => {
    const response = ApiResponse.error('Validation failed', { field: 'email' });

    expect(response.success).toBe(false);
    expect(response.data).toEqual({ field: 'email' });
  });

  it('should include ISO timestamp', () => {
    const response = ApiResponse.ok('test');
    const parsed = new Date(response.timestamp);

    expect(parsed.getTime()).not.toBeNaN();
  });
});

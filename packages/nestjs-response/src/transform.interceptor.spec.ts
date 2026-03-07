import { TransformInterceptor } from './transform.interceptor';
import { ApiResponse } from './api-response';
import { of, lastValueFrom } from 'rxjs';

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  const mockExecutionContext = {
    switchToHttp: jest.fn(),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as any;

  function createCallHandler(data: any) {
    return { handle: () => of(data) };
  }

  it('should wrap a plain object in ApiResponse.ok()', async () => {
    const data = { id: '1' };
    const result = await lastValueFrom(
      interceptor.intercept(mockExecutionContext, createCallHandler(data)),
    );

    expect(result).toBeInstanceOf(ApiResponse);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
    expect(result.timestamp).toBeDefined();
  });

  it('should wrap null data in ApiResponse.ok()', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(mockExecutionContext, createCallHandler(null)),
    );

    expect(result).toBeInstanceOf(ApiResponse);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('should wrap undefined data in ApiResponse.ok()', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(mockExecutionContext, createCallHandler(undefined)),
    );

    expect(result).toBeInstanceOf(ApiResponse);
    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('should pass through data that is already an ApiResponse instance', async () => {
    const existing = ApiResponse.ok({ id: '42' }, 'Already wrapped');
    const result = await lastValueFrom(
      interceptor.intercept(mockExecutionContext, createCallHandler(existing)),
    );

    expect(result).toBe(existing);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '42' });
    expect(result.message).toBe('Already wrapped');
  });

  it('should wrap string data in ApiResponse.ok()', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(mockExecutionContext, createCallHandler('hello')),
    );

    expect(result).toBeInstanceOf(ApiResponse);
    expect(result.success).toBe(true);
    expect(result.data).toBe('hello');
  });

  it('should wrap array data in ApiResponse.ok()', async () => {
    const data = [{ id: '1' }, { id: '2' }];
    const result = await lastValueFrom(
      interceptor.intercept(mockExecutionContext, createCallHandler(data)),
    );

    expect(result).toBeInstanceOf(ApiResponse);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
    expect(result.data).toHaveLength(2);
  });
});

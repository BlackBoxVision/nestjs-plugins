// Mock passport before imports
// canActivate must be a prototype method (not instance property)
// so that the subclass JwtAuthGuard can override it
const mockSuperCanActivate = jest.fn().mockReturnValue(true);
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => {
    class MockAuthGuard {}
    MockAuthGuard.prototype.canActivate = mockSuperCanActivate;
    return MockAuthGuard;
  },
}));

import { ExecutionContext } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockReflector: { getAllAndOverride: jest.Mock };

  const createMockExecutionContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn().mockReturnValue(() => {}),
      getClass: jest.fn().mockReturnValue(class {}),
      switchToHttp: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new JwtAuthGuard(mockReflector as any);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when IS_PUBLIC_KEY metadata is true', () => {
    const context = createMockExecutionContext();
    mockReflector.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should call super.canActivate when route is not public', () => {
    const context = createMockExecutionContext();
    mockReflector.getAllAndOverride.mockReturnValue(false);

    const result = guard.canActivate(context);

    // super.canActivate is mocked to return true
    expect(result).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should call super.canActivate when reflector metadata is undefined (not public)', () => {
    const context = createMockExecutionContext();
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should call super.canActivate when reflector metadata is null', () => {
    const context = createMockExecutionContext();
    mockReflector.getAllAndOverride.mockReturnValue(null);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockExecutionContext = (user?: any): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when no @Roles metadata is set', () => {
    const context = createMockExecutionContext();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when roles metadata is null', () => {
    const context = createMockExecutionContext();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when empty roles array is provided', () => {
    const context = createMockExecutionContext();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return false when user is missing from request', () => {
    const context = createMockExecutionContext(undefined);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should return false when user is null', () => {
    const context = createMockExecutionContext(null);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should return false when user has no role property', () => {
    const context = createMockExecutionContext({ id: 'u1', email: 'test@test.com' });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should return true when user role matches one of the required roles', () => {
    const user = { id: 'u1', role: 'admin' };
    const context = createMockExecutionContext(user);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return false when user role does not match any required role', () => {
    const user = { id: 'u1', role: 'user' };
    const context = createMockExecutionContext(user);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'superadmin']);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should return true when user role is among multiple required roles', () => {
    const user = { id: 'u1', role: 'editor' };
    const context = createMockExecutionContext(user);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'editor']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return false when user role is undefined', () => {
    const user = { id: 'u1', role: undefined };
    const context = createMockExecutionContext(user);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should call reflector.getAllAndOverride with ROLES_KEY and correct targets', () => {
    const context = createMockExecutionContext();
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    guard.canActivate(context);

    expect(spy).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { AuthModuleOptions } from '../interfaces';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  const options: AuthModuleOptions = {
    jwt: { secret: 'test' },
    permissions: {
      rolePermissions: {
        admin: ['*'],
        member: ['items:read', 'items:create'],
        viewer: ['items:read'],
      },
      superAdminRoles: ['admin'],
    },
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector, options);
  });

  function createContext(
    user: any,
    permissions?: string[],
    isPublic = false,
  ): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return isPublic;
      if (key === 'permissions') return permissions;
      return undefined;
    });

    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('should allow public routes', () => {
    const context = createContext(null, ['items:read'], true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when no permissions required', () => {
    const context = createContext({ id: '1', role: 'viewer' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow super admin for any permission', () => {
    const context = createContext(
      { id: '1', role: 'admin' },
      ['items:delete'],
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when user has exact permission', () => {
    const context = createContext(
      { id: '1', role: 'member' },
      ['items:read'],
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny when user lacks permission', () => {
    const context = createContext(
      { id: '1', role: 'viewer' },
      ['items:create'],
    );
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny when user has no role', () => {
    const context = createContext({ id: '1' }, ['items:read']);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should allow wildcard prefix matching', () => {
    const opts: AuthModuleOptions = {
      jwt: { secret: 'test' },
      permissions: {
        rolePermissions: {
          editor: ['items:*'],
        },
      },
    };
    const g = new PermissionsGuard(reflector, opts);
    const context = createContext({ id: '1', role: 'editor' }, ['items:delete']);
    expect(g.canActivate(context)).toBe(true);
  });
});

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTH_MODULE_OPTIONS, AuthModuleOptions } from '../interfaces';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options?: AuthModuleOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      return false;
    }

    const permissionsConfig = this.options?.permissions;
    if (!permissionsConfig) {
      return true;
    }

    // Super admin bypass
    if (permissionsConfig.superAdminRoles?.includes(user.role)) {
      return true;
    }

    const userPermissions =
      permissionsConfig.rolePermissions[user.role] ?? [];

    return requiredPermissions.every((required) =>
      this.hasPermission(userPermissions, required),
    );
  }

  private hasPermission(
    userPermissions: string[],
    required: string,
  ): boolean {
    if (userPermissions.includes('*')) {
      return true;
    }

    if (userPermissions.includes(required)) {
      return true;
    }

    // Check wildcard prefix: 'org:*' matches 'org:read', 'org:write', etc.
    const [prefix] = required.split(':');
    if (prefix && userPermissions.includes(`${prefix}:*`)) {
      return true;
    }

    return false;
  }
}

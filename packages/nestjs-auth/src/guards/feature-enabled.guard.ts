import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AUTH_MODULE_OPTIONS, AuthModuleOptions } from '../interfaces';

/**
 * Guard that checks if the organizations feature is enabled in the resolved
 * module options.  When used with `forRootAsync`, controllers are always
 * registered (NestJS limitation), so this guard provides runtime parity with
 * the `forRoot` path which conditionally registers controllers at declaration
 * time.
 *
 * If the feature is disabled the guard throws a `NotFoundException` so the
 * route behaves as if it does not exist.
 */
@Injectable()
export class OrganizationsFeatureGuard implements CanActivate {
  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.options.features?.organizations === false) {
      throw new NotFoundException();
    }

    return true;
  }
}

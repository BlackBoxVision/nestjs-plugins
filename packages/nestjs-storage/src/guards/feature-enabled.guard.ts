import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { STORAGE_MODULE_OPTIONS, StorageModuleOptions } from '../interfaces';

/**
 * Guard that checks if the `registerController` feature is enabled in the
 * resolved storage module options.  When used with `forRootAsync`, the
 * controller is always registered (NestJS limitation), so this guard provides
 * runtime parity with the `forRoot` path which conditionally registers the
 * controller at declaration time.
 *
 * If the feature is disabled the guard throws a `NotFoundException` so the
 * route behaves as if it does not exist.
 */
@Injectable()
export class StorageFeatureGuard implements CanActivate {
  constructor(
    @Inject(STORAGE_MODULE_OPTIONS)
    private readonly options: StorageModuleOptions,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.options.features?.registerController) {
      throw new NotFoundException();
    }

    return true;
  }
}

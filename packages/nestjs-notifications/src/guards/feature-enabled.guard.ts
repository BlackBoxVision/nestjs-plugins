import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NOTIFICATION_MODULE_OPTIONS,
  NotificationModuleOptions,
} from '../interfaces';

/**
 * Guards that check whether a specific notification channel or feature is
 * enabled in the resolved module options.  When used with `forRootAsync`,
 * controllers are always registered (NestJS limitation), so these guards
 * provide runtime parity with the `forRoot` path which conditionally
 * registers controllers at declaration time.
 *
 * If the channel/feature is disabled the guard throws a `NotFoundException`
 * so the route behaves as if it does not exist.
 */

@Injectable()
export class InAppFeatureGuard implements CanActivate {
  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.options.channels.inApp?.enabled) {
      throw new NotFoundException();
    }

    return true;
  }
}

@Injectable()
export class PushFeatureGuard implements CanActivate {
  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.options.channels.push?.enabled) {
      throw new NotFoundException();
    }

    return true;
  }
}

@Injectable()
export class PreferencesFeatureGuard implements CanActivate {
  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.options.features?.preferences === false) {
      throw new NotFoundException();
    }

    return true;
  }
}

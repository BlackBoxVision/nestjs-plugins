import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  AUTH_NOTIFICATION_CONFIG,
  AuthNotificationConfig,
  AuthNotificationAsyncOptions,
} from './auth-notification.interfaces';
import { AuthNotificationListener } from './auth-notification.listener';

@Module({})
export class AuthNotificationModule {
  static forRoot(config: AuthNotificationConfig): DynamicModule {
    return {
      module: AuthNotificationModule,
      providers: [
        {
          provide: AUTH_NOTIFICATION_CONFIG,
          useValue: config,
        },
        AuthNotificationListener,
      ],
      exports: [AuthNotificationListener],
    };
  }

  static forRootAsync(options: AuthNotificationAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: AUTH_NOTIFICATION_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: AuthNotificationModule,
      imports: options.imports ?? [],
      providers: [configProvider, AuthNotificationListener],
      exports: [AuthNotificationListener],
    };
  }
}

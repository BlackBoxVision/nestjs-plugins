import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  NOTIFICATION_MODULE_OPTIONS,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  type NotificationModuleOptions,
  type NotificationModuleAsyncOptions,
} from './interfaces';
import { NotificationService } from './notification.service';
import { InAppService } from './channels/in-app/in-app.service';
import { InAppController } from './channels/in-app/in-app.controller';
import { EmailProcessor } from './channels/email/email.processor';
import { SmsProcessor } from './channels/sms/sms.processor';
import { PreferenceService } from './preferences/preference.service';
import { PreferenceController } from './preferences/preference.controller';
import { TemplateService } from './templates/template.service';
import { SmtpEmailProvider } from './channels/email/providers/smtp.provider';
import { SendGridEmailProvider } from './channels/email/providers/sendgrid.provider';
import { TwilioSmsProvider } from './channels/sms/providers/twilio.provider';

@Module({})
export class NotificationModule {
  static forRoot(options: NotificationModuleOptions): DynamicModule {
    return this.buildModule({
      providers: [
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    }, options);
  }

  static forRootAsync(asyncOptions: NotificationModuleAsyncOptions): DynamicModule {
    return this.buildAsyncModule(asyncOptions);
  }

  private static buildModule(
    config: { providers: Provider[] },
    options: NotificationModuleOptions,
  ): DynamicModule {
    const providers: Provider[] = [...config.providers];
    const controllers: Type[] = [];
    const imports: DynamicModule[] = [];

    // Email channel
    if (options.channels.email?.enabled) {
      const emailConfig = options.channels.email;
      providers.push(this.createEmailProvider(emailConfig));
      providers.push(EmailProcessor);

      if (options.queue?.redis) {
        imports.push(
          BullModule.registerQueue({
            name: 'notifications-email',
            connection: {
              host: options.queue.redis.host,
              port: options.queue.redis.port ?? 6379,
              password: options.queue.redis.password,
            },
          }),
        );
      }
    }

    // In-app channel
    if (options.channels.inApp?.enabled) {
      providers.push(InAppService);
      controllers.push(InAppController);
    }

    // SMS channel
    if (options.channels.sms?.enabled) {
      const smsConfig = options.channels.sms;
      providers.push(this.createSmsProvider(smsConfig));
      providers.push(SmsProcessor);

      if (options.queue?.redis) {
        imports.push(
          BullModule.registerQueue({
            name: 'notifications-sms',
            connection: {
              host: options.queue.redis.host,
              port: options.queue.redis.port ?? 6379,
              password: options.queue.redis.password,
            },
          }),
        );
      }
    }

    // Preferences feature
    if (options.features?.preferences !== false) {
      providers.push(PreferenceService);
      controllers.push(PreferenceController);
    }

    // Templates feature
    if (options.features?.templates !== false) {
      providers.push(TemplateService);
    }

    // Main service
    providers.push(NotificationService);

    return {
      module: NotificationModule,
      imports,
      providers,
      controllers,
      exports: [NotificationService, NOTIFICATION_MODULE_OPTIONS, ...(
        options.channels.inApp?.enabled ? [InAppService] : []
      ), ...(
        options.features?.preferences !== false ? [PreferenceService] : []
      ), ...(
        options.features?.templates !== false ? [TemplateService] : []
      )],
      global: false,
    };
  }

  private static buildAsyncModule(
    asyncOptions: NotificationModuleAsyncOptions,
  ): DynamicModule {
    const optionsProvider: Provider = {
      provide: NOTIFICATION_MODULE_OPTIONS,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject ?? [],
    };

    // For async, we register all possible providers and let them fail gracefully
    // if their channel is not enabled (via @Optional decorators in constructors)
    const providers: Provider[] = [
      optionsProvider,
      NotificationService,
      InAppService,
      PreferenceService,
      TemplateService,
      // Conditional email provider factory
      {
        provide: EMAIL_PROVIDER,
        useFactory: (options: NotificationModuleOptions) => {
          const emailConfig = options.channels.email;
          if (!emailConfig || !emailConfig.enabled) {
            return null;
          }
          return this.instantiateEmailProvider(emailConfig);
        },
        inject: [NOTIFICATION_MODULE_OPTIONS],
      },
      // Conditional SMS provider factory
      {
        provide: SMS_PROVIDER,
        useFactory: (options: NotificationModuleOptions) => {
          const smsConfig = options.channels.sms;
          if (!smsConfig || !smsConfig.enabled) {
            return null;
          }
          return this.instantiateSmsProvider(smsConfig);
        },
        inject: [NOTIFICATION_MODULE_OPTIONS],
      },
    ];

    const controllers: Type[] = [InAppController, PreferenceController];

    return {
      module: NotificationModule,
      imports: asyncOptions.imports ?? [],
      providers,
      controllers,
      exports: [
        NotificationService,
        NOTIFICATION_MODULE_OPTIONS,
        InAppService,
        PreferenceService,
        TemplateService,
      ],
      global: false,
    };
  }

  private static createEmailProvider(
    config: Extract<NotificationModuleOptions['channels']['email'], { enabled: true }>,
  ): Provider {
    return {
      provide: EMAIL_PROVIDER,
      useValue: this.instantiateEmailProvider(config),
    };
  }

  private static instantiateEmailProvider(
    config: Extract<NotificationModuleOptions['channels']['email'], { enabled: true }>,
  ) {
    switch (config.provider) {
      case 'smtp':
        return new SmtpEmailProvider(config.providerOptions);
      case 'sendgrid':
        return new SendGridEmailProvider(config.providerOptions);
      case 'ses':
        throw new Error(
          'SES email provider is not yet implemented. Contributions welcome.',
        );
      case 'resend':
        throw new Error(
          'Resend email provider is not yet implemented. Contributions welcome.',
        );
      default:
        throw new Error(`Unknown email provider: ${(config as any).provider}`);
    }
  }

  private static createSmsProvider(
    config: Extract<NotificationModuleOptions['channels']['sms'], { enabled: true }>,
  ): Provider {
    return {
      provide: SMS_PROVIDER,
      useValue: this.instantiateSmsProvider(config),
    };
  }

  private static instantiateSmsProvider(
    config: Extract<NotificationModuleOptions['channels']['sms'], { enabled: true }>,
  ) {
    switch (config.provider) {
      case 'twilio':
        return new TwilioSmsProvider(config.providerOptions);
      default:
        throw new Error(`Unknown SMS provider: ${(config as any).provider}`);
    }
  }
}

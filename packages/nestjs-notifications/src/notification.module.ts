import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import {
  NOTIFICATION_MODULE_OPTIONS,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  PUSH_PROVIDER,
  EMAIL_WORKER,
  SMS_WORKER,
  PUSH_WORKER,
  type NotificationModuleOptions,
  type NotificationModuleAsyncOptions,
  type EmailProvider,
  type SmsProvider,
  type PushProvider,
} from './interfaces';
import { NotificationService } from './notification.service';
import { InAppService } from './channels/in-app/in-app.service';
import { InAppController } from './channels/in-app/in-app.controller';
import { EmailProcessor } from './channels/email/email.processor';
import { SmsProcessor } from './channels/sms/sms.processor';
import { PushProcessor } from './channels/push/push.processor';
import { DeviceTokenService } from './channels/push/device-token.service';
import { DeviceTokenController } from './channels/push/device-token.controller';
import { PreferenceService } from './preferences/preference.service';
import { PreferenceController } from './preferences/preference.controller';
import { TemplateService } from './templates/template.service';
import { SmtpEmailProvider } from './channels/email/providers/smtp.provider';
import { SendGridEmailProvider } from './channels/email/providers/sendgrid.provider';
import { TwilioSmsProvider } from './channels/sms/providers/twilio.provider';
import { FirebasePushProvider } from './channels/push/providers/firebase.provider';
import { LogSmsProvider } from './channels/sms/providers/log.provider';
import { LogPushProvider } from './channels/push/providers/log.provider';
import { WorkerCleanupService } from './worker-cleanup.service';

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

    // Push channel
    if (options.channels.push?.enabled) {
      const pushConfig = options.channels.push;
      providers.push(this.createPushProvider(pushConfig));
      providers.push(PushProcessor);
      providers.push(DeviceTokenService);
      controllers.push(DeviceTokenController);

      if (options.queue?.redis) {
        imports.push(
          BullModule.registerQueue({
            name: 'notifications-push',
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
        options.channels.push?.enabled ? [DeviceTokenService] : []
      ), ...(
        options.features?.preferences !== false ? [PreferenceService] : []
      ), ...(
        options.features?.templates !== false ? [TemplateService] : []
      )],
      global: options.isGlobal ?? false,
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
      DeviceTokenService,
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
      // Conditional push provider factory
      {
        provide: PUSH_PROVIDER,
        useFactory: (options: NotificationModuleOptions) => {
          const pushConfig = options.channels.push;
          if (!pushConfig || !pushConfig.enabled) {
            return null;
          }
          return this.instantiatePushProvider(pushConfig);
        },
        inject: [NOTIFICATION_MODULE_OPTIONS],
      },
      // Conditional BullMQ queue providers — creates Queue instances only
      // when the channel is enabled and Redis config is present.
      // We avoid BullModule.registerQueueAsync here to prevent @Processor
      // workers from being created for disabled channels.
      {
        provide: getQueueToken('notifications-email'),
        useFactory: (options: NotificationModuleOptions) => {
          if (!options.channels.email?.enabled || !options.queue?.redis) {
            return null;
          }
          return new Queue('notifications-email', {
            connection: {
              host: options.queue.redis.host,
              port: options.queue.redis.port ?? 6379,
              password: options.queue.redis.password,
            },
          });
        },
        inject: [NOTIFICATION_MODULE_OPTIONS],
      },
      {
        provide: getQueueToken('notifications-sms'),
        useFactory: (options: NotificationModuleOptions) => {
          if (!options.channels.sms?.enabled || !options.queue?.redis) {
            return null;
          }
          return new Queue('notifications-sms', {
            connection: {
              host: options.queue.redis.host,
              port: options.queue.redis.port ?? 6379,
              password: options.queue.redis.password,
            },
          });
        },
        inject: [NOTIFICATION_MODULE_OPTIONS],
      },
      {
        provide: getQueueToken('notifications-push'),
        useFactory: (options: NotificationModuleOptions) => {
          if (!options.channels.push?.enabled || !options.queue?.redis) {
            return null;
          }
          return new Queue('notifications-push', {
            connection: {
              host: options.queue.redis.host,
              port: options.queue.redis.port ?? 6379,
              password: options.queue.redis.password,
            },
          });
        },
        inject: [NOTIFICATION_MODULE_OPTIONS],
      },
      // Worker factories — create BullMQ Workers manually to bypass @Processor
      // decorator discovery which would start workers before async options resolve.
      {
        provide: EMAIL_WORKER,
        useFactory: (
          options: NotificationModuleOptions,
          emailProvider: EmailProvider | null,
          prisma: any,
        ) => {
          if (!options.channels.email?.enabled || !options.queue?.redis || !emailProvider) {
            return null;
          }
          const processor = new EmailProcessor(emailProvider, prisma);
          return new Worker(
            'notifications-email',
            async (job: Job) => processor.process(job),
            {
              connection: {
                host: options.queue.redis.host,
                port: options.queue.redis.port ?? 6379,
                password: options.queue.redis.password,
              },
            },
          );
        },
        inject: [NOTIFICATION_MODULE_OPTIONS, EMAIL_PROVIDER, 'PRISMA_SERVICE'],
      },
      {
        provide: SMS_WORKER,
        useFactory: (
          options: NotificationModuleOptions,
          smsProvider: SmsProvider | null,
          prisma: any,
        ) => {
          if (!options.channels.sms?.enabled || !options.queue?.redis || !smsProvider) {
            return null;
          }
          const processor = new SmsProcessor(smsProvider, prisma);
          return new Worker(
            'notifications-sms',
            async (job: Job) => processor.process(job),
            {
              connection: {
                host: options.queue.redis.host,
                port: options.queue.redis.port ?? 6379,
                password: options.queue.redis.password,
              },
            },
          );
        },
        inject: [NOTIFICATION_MODULE_OPTIONS, SMS_PROVIDER, 'PRISMA_SERVICE'],
      },
      {
        provide: PUSH_WORKER,
        useFactory: (
          options: NotificationModuleOptions,
          pushProvider: PushProvider | null,
          prisma: any,
        ) => {
          if (!options.channels.push?.enabled || !options.queue?.redis || !pushProvider) {
            return null;
          }
          const processor = new PushProcessor(pushProvider, prisma);
          return new Worker(
            'notifications-push',
            async (job: Job) => processor.process(job),
            {
              connection: {
                host: options.queue.redis.host,
                port: options.queue.redis.port ?? 6379,
                password: options.queue.redis.password,
              },
            },
          );
        },
        inject: [NOTIFICATION_MODULE_OPTIONS, PUSH_PROVIDER, 'PRISMA_SERVICE'],
      },
      WorkerCleanupService,
    ];

    const controllers: Type[] = [InAppController, DeviceTokenController, PreferenceController];

    return {
      module: NotificationModule,
      imports: asyncOptions.imports ?? [],
      providers,
      controllers,
      exports: [
        NotificationService,
        NOTIFICATION_MODULE_OPTIONS,
        InAppService,
        DeviceTokenService,
        PreferenceService,
        TemplateService,
      ],
      global: asyncOptions.isGlobal ?? false,
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
      case 'log':
        return new LogSmsProvider();
      default:
        throw new Error(`Unknown SMS provider: ${(config as any).provider}`);
    }
  }

  private static createPushProvider(
    config: Extract<NotificationModuleOptions['channels']['push'], { enabled: true }>,
  ): Provider {
    return {
      provide: PUSH_PROVIDER,
      useValue: this.instantiatePushProvider(config),
    };
  }

  private static instantiatePushProvider(
    config: Extract<NotificationModuleOptions['channels']['push'], { enabled: true }>,
  ) {
    switch (config.provider) {
      case 'firebase':
        return new FirebasePushProvider(config.providerOptions);
      case 'log':
        return new LogPushProvider();
      default:
        throw new Error(`Unknown push provider: ${(config as any).provider}`);
    }
  }
}

jest.mock('./channels/email/providers/smtp.provider', () => ({
  SmtpEmailProvider: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
}));
jest.mock('./channels/email/providers/sendgrid.provider', () => ({
  SendGridEmailProvider: jest
    .fn()
    .mockImplementation(() => ({ send: jest.fn() })),
}));
jest.mock('./channels/sms/providers/twilio.provider', () => ({
  TwilioSmsProvider: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
}));
jest.mock('./channels/push/providers/firebase.provider', () => ({
  FirebasePushProvider: jest
    .fn()
    .mockImplementation(() => ({ send: jest.fn() })),
}));
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@nestjs/bullmq', () => ({
  BullModule: {
    registerQueue: jest.fn().mockReturnValue({
      module: class {},
      providers: [],
      exports: [],
    }),
  },
  InjectQueue: () => () => {},
  Processor: () => () => {},
  WorkerHost: class WorkerHost {},
  getQueueToken: (name: string) => `BullQueue_${name}`,
}));

import { NotificationModule } from './notification.module';
import { NotificationService } from './notification.service';
import { PreferenceService } from './preferences/preference.service';
import { PreferenceController } from './preferences/preference.controller';
import { TemplateService } from './templates/template.service';
import { InAppService } from './channels/in-app/in-app.service';
import { InAppController } from './channels/in-app/in-app.controller';
import { EmailProcessor } from './channels/email/email.processor';
import { SmsProcessor } from './channels/sms/sms.processor';
import { PushProcessor } from './channels/push/push.processor';
import { DeviceTokenService } from './channels/push/device-token.service';
import { DeviceTokenController } from './channels/push/device-token.controller';
import {
  NOTIFICATION_MODULE_OPTIONS,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  PUSH_PROVIDER,
  type NotificationModuleOptions,
} from './interfaces';

describe('NotificationModule', () => {
  describe('forRoot', () => {
    it('should include NotificationService, PreferenceService, and TemplateService with minimal config', () => {
      const options: NotificationModuleOptions = {
        channels: {},
      };

      const result = NotificationModule.forRoot(options);

      expect(result.module).toBe(NotificationModule);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).toContain(NotificationService);
      expect(providerTokens).toContain(PreferenceService);
      expect(providerTokens).toContain(TemplateService);
    });

    it('should include PreferenceController with minimal config', () => {
      const options: NotificationModuleOptions = {
        channels: {},
      };

      const result = NotificationModule.forRoot(options);

      expect(result.controllers).toContain(PreferenceController);
    });

    it('should include EmailProcessor and EMAIL_PROVIDER when email is enabled with smtp', () => {
      const options: NotificationModuleOptions = {
        channels: {
          email: {
            enabled: true,
            provider: 'smtp',
            providerOptions: {
              host: 'localhost',
              port: 587,
              from: 'test@example.com',
            },
          },
        },
        queue: {
          redis: { host: 'localhost' },
        },
      };

      const result = NotificationModule.forRoot(options);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).toContain(EmailProcessor);
      expect(providerTokens).toContain(EMAIL_PROVIDER);
    });

    it('should register email BullMQ queue when email is enabled with redis', () => {
      const { BullModule } = require('@nestjs/bullmq');

      const options: NotificationModuleOptions = {
        channels: {
          email: {
            enabled: true,
            provider: 'smtp',
            providerOptions: {
              host: 'localhost',
              port: 587,
              from: 'test@example.com',
            },
          },
        },
        queue: {
          redis: { host: 'localhost', port: 6379 },
        },
      };

      NotificationModule.forRoot(options);

      expect(BullModule.registerQueue).toHaveBeenCalledWith({
        name: 'notifications-email',
        connection: {
          host: 'localhost',
          port: 6379,
          password: undefined,
        },
      });
    });

    it('should include InAppService and InAppController when inApp is enabled', () => {
      const options: NotificationModuleOptions = {
        channels: {
          inApp: { enabled: true },
        },
      };

      const result = NotificationModule.forRoot(options);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).toContain(InAppService);
      expect(result.controllers).toContain(InAppController);
    });

    it('should not include InAppService and InAppController when inApp is disabled', () => {
      const options: NotificationModuleOptions = {
        channels: {
          inApp: { enabled: false },
        },
      };

      const result = NotificationModule.forRoot(options);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).not.toContain(InAppService);
      expect(result.controllers).not.toContain(InAppController);
    });

    it('should include SmsProcessor and SMS_PROVIDER when sms is enabled with twilio', () => {
      const options: NotificationModuleOptions = {
        channels: {
          sms: {
            enabled: true,
            provider: 'twilio',
            providerOptions: {
              accountSid: 'AC123',
              authToken: 'token',
              from: '+1234567890',
            },
          },
        },
        queue: {
          redis: { host: 'localhost' },
        },
      };

      const result = NotificationModule.forRoot(options);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).toContain(SmsProcessor);
      expect(providerTokens).toContain(SMS_PROVIDER);
    });

    it('should include PushProcessor, DeviceTokenService, DeviceTokenController, and PUSH_PROVIDER when push is enabled', () => {
      const options: NotificationModuleOptions = {
        channels: {
          push: {
            enabled: true,
            provider: 'firebase',
            providerOptions: {
              serviceAccountKey: { projectId: 'test' },
            },
          },
        },
        queue: {
          redis: { host: 'localhost' },
        },
      };

      const result = NotificationModule.forRoot(options);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).toContain(PushProcessor);
      expect(providerTokens).toContain(DeviceTokenService);
      expect(providerTokens).toContain(PUSH_PROVIDER);
      expect(result.controllers).toContain(DeviceTokenController);
    });

    it('should NOT include PreferenceService and PreferenceController when preferences is disabled', () => {
      const options: NotificationModuleOptions = {
        channels: {},
        features: {
          preferences: false,
        },
      };

      const result = NotificationModule.forRoot(options);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).not.toContain(PreferenceService);
      expect(result.controllers).not.toContain(PreferenceController);
    });

    it('should NOT include TemplateService when templates is disabled', () => {
      const options: NotificationModuleOptions = {
        channels: {},
        features: {
          templates: false,
        },
      };

      const result = NotificationModule.forRoot(options);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).not.toContain(TemplateService);
    });

    it('should export NotificationService and NOTIFICATION_MODULE_OPTIONS', () => {
      const options: NotificationModuleOptions = {
        channels: {},
      };

      const result = NotificationModule.forRoot(options);

      expect(result.exports).toContain(NotificationService);
      expect(result.exports).toContain(NOTIFICATION_MODULE_OPTIONS);
    });

    it('should export InAppService when inApp is enabled', () => {
      const options: NotificationModuleOptions = {
        channels: {
          inApp: { enabled: true },
        },
      };

      const result = NotificationModule.forRoot(options);

      expect(result.exports).toContain(InAppService);
    });

    it('should export DeviceTokenService when push is enabled', () => {
      const options: NotificationModuleOptions = {
        channels: {
          push: {
            enabled: true,
            provider: 'firebase',
            providerOptions: {
              serviceAccountKey: { projectId: 'test' },
            },
          },
        },
        queue: {
          redis: { host: 'localhost' },
        },
      };

      const result = NotificationModule.forRoot(options);

      expect(result.exports).toContain(DeviceTokenService);
    });

    it('should set global to false', () => {
      const options: NotificationModuleOptions = {
        channels: {},
      };

      const result = NotificationModule.forRoot(options);

      expect(result.global).toBe(false);
    });
  });

  describe('forRootAsync', () => {
    it('should return a DynamicModule with all providers and controllers', () => {
      const result = NotificationModule.forRootAsync({
        useFactory: () => ({
          channels: {},
        }),
        inject: [],
      });

      expect(result.module).toBe(NotificationModule);

      const providerTokens = extractProviderTokens(result.providers as any[]);
      expect(providerTokens).toContain(NOTIFICATION_MODULE_OPTIONS);
      expect(providerTokens).toContain(NotificationService);
      expect(providerTokens).toContain(InAppService);
      expect(providerTokens).toContain(DeviceTokenService);
      expect(providerTokens).toContain(PreferenceService);
      expect(providerTokens).toContain(TemplateService);
      expect(providerTokens).toContain(EMAIL_PROVIDER);
      expect(providerTokens).toContain(SMS_PROVIDER);
      expect(providerTokens).toContain(PUSH_PROVIDER);
      expect(providerTokens).toContain('BullQueue_notifications-email');
      expect(providerTokens).toContain('BullQueue_notifications-sms');
      expect(providerTokens).toContain('BullQueue_notifications-push');

      expect(result.controllers).toContain(InAppController);
      expect(result.controllers).toContain(DeviceTokenController);
      expect(result.controllers).toContain(PreferenceController);
    });

    it('should use useFactory and inject from async options', () => {
      const factoryFn = jest.fn().mockReturnValue({ channels: {} });
      const injectTokens = ['CONFIG_SERVICE'];

      const result = NotificationModule.forRootAsync({
        useFactory: factoryFn,
        inject: injectTokens,
      });

      const optionsProvider = (result.providers as any[]).find(
        (p: any) => p.provide === NOTIFICATION_MODULE_OPTIONS,
      );

      expect(optionsProvider).toBeDefined();
      expect(optionsProvider.useFactory).toBe(factoryFn);
      expect(optionsProvider.inject).toEqual(injectTokens);
    });

    it('should pass imports from async options', () => {
      const mockImport = { module: class TestModule {} };

      const result = NotificationModule.forRootAsync({
        imports: [mockImport as any],
        useFactory: () => ({ channels: {} }),
      });

      expect(result.imports).toContain(mockImport);
    });

    it('should default inject to empty array when not provided', () => {
      const result = NotificationModule.forRootAsync({
        useFactory: () => ({ channels: {} }),
      });

      const optionsProvider = (result.providers as any[]).find(
        (p: any) => p.provide === NOTIFICATION_MODULE_OPTIONS,
      );

      expect(optionsProvider.inject).toEqual([]);
    });

    it('should export all core services', () => {
      const result = NotificationModule.forRootAsync({
        useFactory: () => ({ channels: {} }),
      });

      expect(result.exports).toContain(NotificationService);
      expect(result.exports).toContain(NOTIFICATION_MODULE_OPTIONS);
      expect(result.exports).toContain(InAppService);
      expect(result.exports).toContain(DeviceTokenService);
      expect(result.exports).toContain(PreferenceService);
      expect(result.exports).toContain(TemplateService);
    });
  });

  describe('provider instantiation errors', () => {
    it('should throw for ses email provider as not yet implemented', () => {
      const options: NotificationModuleOptions = {
        channels: {
          email: {
            enabled: true,
            provider: 'ses' as any,
            providerOptions: {
              region: 'us-east-1',
              accessKeyId: 'key',
              secretAccessKey: 'secret',
              from: 'test@example.com',
            } as any,
          },
        },
      };

      expect(() => NotificationModule.forRoot(options)).toThrow(
        'SES email provider is not yet implemented',
      );
    });

    it('should throw for resend email provider as not yet implemented', () => {
      const options: NotificationModuleOptions = {
        channels: {
          email: {
            enabled: true,
            provider: 'resend' as any,
            providerOptions: {
              apiKey: 'key',
              from: 'test@example.com',
            } as any,
          },
        },
      };

      expect(() => NotificationModule.forRoot(options)).toThrow(
        'Resend email provider is not yet implemented',
      );
    });

    it('should throw for unknown email provider', () => {
      const options: NotificationModuleOptions = {
        channels: {
          email: {
            enabled: true,
            provider: 'mailgun' as any,
            providerOptions: {} as any,
          },
        },
      };

      expect(() => NotificationModule.forRoot(options)).toThrow(
        'Unknown email provider: mailgun',
      );
    });

    it('should throw for unknown SMS provider', () => {
      const options: NotificationModuleOptions = {
        channels: {
          sms: {
            enabled: true,
            provider: 'vonage' as any,
            providerOptions: {} as any,
          },
        },
      };

      expect(() => NotificationModule.forRoot(options)).toThrow(
        'Unknown SMS provider: vonage',
      );
    });

    it('should throw for unknown push provider', () => {
      const options: NotificationModuleOptions = {
        channels: {
          push: {
            enabled: true,
            provider: 'apns' as any,
            providerOptions: {} as any,
          },
        },
      };

      expect(() => NotificationModule.forRoot(options)).toThrow(
        'Unknown push provider: apns',
      );
    });
  });
});

/**
 * Extracts provider tokens from a mixed array of class providers and object providers.
 */
function extractProviderTokens(providers: any[]): any[] {
  return providers.map((p) => {
    if (typeof p === 'function') {
      return p;
    }
    if (p && typeof p === 'object' && 'provide' in p) {
      return p.provide;
    }
    return p;
  });
}

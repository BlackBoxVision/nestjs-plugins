import { DynamicModule, Module, Provider } from '@nestjs/common';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleAsyncOptions,
  OtpModuleOptions,
} from './interfaces';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { TotpProvider } from './providers/totp.provider';
import { SmsOtpProvider } from './providers/sms-otp.provider';
import { EmailOtpProvider } from './providers/email-otp.provider';
import { OtpVerifiedGuard } from './guards/otp-verified.guard';
import { OtpRateLimitGuard } from './guards/otp-rate-limit.guard';

@Module({})
export class OtpModule {
  static forRoot(options: OtpModuleOptions): DynamicModule {
    const providers = OtpModule.buildProviders(options);

    return {
      module: OtpModule,
      controllers: [OtpController],
      providers: [
        { provide: OTP_MODULE_OPTIONS, useValue: options },
        ...providers,
        { provide: 'OTP_SERVICE', useExisting: OtpService },
      ],
      exports: [
        OtpService,
        'OTP_SERVICE',
        OtpVerifiedGuard,
        OtpRateLimitGuard,
        OTP_MODULE_OPTIONS,
      ],
    };
  }

  static forRootAsync(asyncOptions: OtpModuleAsyncOptions): DynamicModule {
    return {
      module: OtpModule,
      imports: [...(asyncOptions.imports ?? [])],
      controllers: [OtpController],
      providers: [
        {
          provide: OTP_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
        OtpService,
        { provide: 'OTP_SERVICE', useExisting: OtpService },
        OtpModule.createAsyncTotpProvider(),
        OtpModule.createAsyncSmsProvider(),
        OtpModule.createAsyncEmailProvider(),
        OtpVerifiedGuard,
        OtpRateLimitGuard,
      ],
      exports: [
        OtpService,
        'OTP_SERVICE',
        OtpVerifiedGuard,
        OtpRateLimitGuard,
        OTP_MODULE_OPTIONS,
      ],
    };
  }

  private static buildProviders(options: OtpModuleOptions): Provider[] {
    const providers: Provider[] = [
      OtpService,
      OtpVerifiedGuard,
      OtpRateLimitGuard,
    ];

    const totpConfig = options.methods.totp;
    if (totpConfig && 'issuer' in totpConfig) {
      providers.push(TotpProvider);
    }

    const smsConfig = options.methods.sms;
    if (smsConfig && 'method' in smsConfig && smsConfig.method === 'sms') {
      providers.push(SmsOtpProvider);
    }

    const emailConfig = options.methods.email;
    if (emailConfig && 'method' in emailConfig && emailConfig.method === 'email') {
      providers.push(EmailOtpProvider);
    }

    return providers;
  }

  private static createAsyncTotpProvider(): Provider {
    return {
      provide: TotpProvider,
      useFactory: (options: OtpModuleOptions) => {
        const config = options.methods.totp;
        if (config && 'issuer' in config) {
          return new TotpProvider(options);
        }
        return null;
      },
      inject: [OTP_MODULE_OPTIONS],
    };
  }

  private static createAsyncSmsProvider(): Provider {
    return {
      provide: SmsOtpProvider,
      useFactory: (options: OtpModuleOptions) => {
        const config = options.methods.sms;
        if (config && 'method' in config && config.method === 'sms') {
          return new SmsOtpProvider(options);
        }
        return null;
      },
      inject: [OTP_MODULE_OPTIONS],
    };
  }

  private static createAsyncEmailProvider(): Provider {
    return {
      provide: EmailOtpProvider,
      useFactory: (options: OtpModuleOptions) => {
        const config = options.methods.email;
        if (config && 'method' in config && config.method === 'email') {
          return new EmailOtpProvider(options);
        }
        return null;
      },
      inject: [OTP_MODULE_OPTIONS],
    };
  }
}

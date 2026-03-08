import { Injectable, Inject, Logger } from '@nestjs/common';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleOptions,
  OtpGenerateResult,
  SmsMethodConfig,
} from '../interfaces';
import { BaseCodeOtpProvider } from './base-code-otp.provider';

@Injectable()
export class SmsOtpProvider extends BaseCodeOtpProvider {
  protected readonly logger = new Logger(SmsOtpProvider.name);
  private readonly config: SmsMethodConfig;

  constructor(
    @Inject(OTP_MODULE_OPTIONS)
    private readonly options: OtpModuleOptions,
  ) {
    super();
    const smsConfig = options.methods.sms;
    if (!smsConfig || !('method' in smsConfig) || smsConfig.method !== 'sms') {
      throw new Error('SMS method config is required for SmsOtpProvider');
    }
    this.config = smsConfig;
  }

  async generate(_userId: string, _context?: string): Promise<OtpGenerateResult> {
    const codeLength = this.config.codeLength ?? 6;
    const expiresInSeconds = this.config.expiresInSeconds ?? 300;

    const code = this.generateNumericCode(codeLength);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return { code, expiresAt };
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleOptions,
  OtpGenerateResult,
  EmailMethodConfig,
} from '../interfaces';
import { BaseCodeOtpProvider } from './base-code-otp.provider';

@Injectable()
export class EmailOtpProvider extends BaseCodeOtpProvider {
  protected readonly logger = new Logger(EmailOtpProvider.name);
  private readonly config: EmailMethodConfig;

  constructor(
    @Inject(OTP_MODULE_OPTIONS)
    private readonly options: OtpModuleOptions,
  ) {
    super();
    const emailConfig = options.methods.email;
    if (!emailConfig || !('method' in emailConfig) || emailConfig.method !== 'email') {
      throw new Error('Email method config is required for EmailOtpProvider');
    }
    this.config = emailConfig;
  }

  async generate(_userId: string, _context?: string): Promise<OtpGenerateResult> {
    const codeLength = this.config.codeLength ?? 6;
    const expiresInSeconds = this.config.expiresInSeconds ?? 600;

    const code = this.generateNumericCode(codeLength);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return { code, expiresAt };
  }
}

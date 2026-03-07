import { Injectable, Inject, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleOptions,
  OtpProvider,
  OtpGenerateResult,
  SmsMethodConfig,
} from '../interfaces';

@Injectable()
export class SmsOtpProvider implements OtpProvider {
  private readonly logger = new Logger(SmsOtpProvider.name);
  private readonly config: SmsMethodConfig;

  constructor(
    @Inject(OTP_MODULE_OPTIONS)
    private readonly options: OtpModuleOptions,
  ) {
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

  async verify(_userId: string, code: string, storedHash?: string): Promise<boolean> {
    if (!storedHash) return false;

    try {
      return bcrypt.compare(code, storedHash);
    } catch (error) {
      this.logger.error('SMS OTP verification failed', error);
      return false;
    }
  }

  async hashCode(code: string): Promise<string> {
    return bcrypt.hash(code, 10);
  }

  private generateNumericCode(length: number): string {
    const max = Math.pow(10, length);
    const randomValue = crypto.randomInt(0, max);
    return randomValue.toString().padStart(length, '0');
  }
}

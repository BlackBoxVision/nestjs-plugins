import { Injectable, Inject, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleOptions,
  OtpProvider,
  OtpGenerateResult,
  EmailMethodConfig,
} from '../interfaces';

@Injectable()
export class EmailOtpProvider implements OtpProvider {
  private readonly logger = new Logger(EmailOtpProvider.name);
  private readonly config: EmailMethodConfig;

  constructor(
    @Inject(OTP_MODULE_OPTIONS)
    private readonly options: OtpModuleOptions,
  ) {
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

  async verify(_userId: string, code: string, storedHash?: string): Promise<boolean> {
    if (!storedHash) return false;

    try {
      return bcrypt.compare(code, storedHash);
    } catch (error) {
      this.logger.error('Email OTP verification failed', error);
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

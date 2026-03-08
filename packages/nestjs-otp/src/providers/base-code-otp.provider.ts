import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { OtpProvider, OtpGenerateResult } from '../interfaces';

/**
 * Abstract base class for code-based OTP providers (SMS, Email).
 *
 * Encapsulates the shared verify, hashCode, and generateNumericCode logic
 * so that concrete providers only need to implement `generate()` and supply
 * their own configuration / logger context.
 */
export abstract class BaseCodeOtpProvider implements OtpProvider {
  protected abstract readonly logger: Logger;

  abstract generate(userId: string, context?: string): Promise<OtpGenerateResult>;

  async verify(_userId: string, code: string, storedHash?: string): Promise<boolean> {
    if (!storedHash) return false;

    try {
      return bcrypt.compare(code, storedHash);
    } catch (error) {
      this.logger.error('OTP verification failed', error);
      return false;
    }
  }

  async hashCode(code: string): Promise<string> {
    return bcrypt.hash(code, 10);
  }

  protected generateNumericCode(length: number): string {
    const max = Math.pow(10, length);
    const randomValue = crypto.randomInt(0, max);
    return randomValue.toString().padStart(length, '0');
  }
}

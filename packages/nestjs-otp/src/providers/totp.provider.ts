import { Injectable, Inject, Logger } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleOptions,
  OtpProvider,
  OtpGenerateResult,
  TotpMethodConfig,
  TotpSetupResult,
} from '../interfaces';

@Injectable()
export class TotpProvider implements OtpProvider {
  private readonly logger = new Logger(TotpProvider.name);
  private readonly config: TotpMethodConfig;
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(OTP_MODULE_OPTIONS)
    private readonly options: OtpModuleOptions,
  ) {
    const totpConfig = options.methods.totp;
    if (!totpConfig || !('issuer' in totpConfig)) {
      throw new Error('TOTP method config is required for TotpProvider');
    }
    this.config = totpConfig;
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(options.encryptionKey)
      .digest();
  }

  async generate(_userId: string, _context?: string): Promise<OtpGenerateResult> {
    throw new Error(
      'TOTP does not support code generation. Use setupTotp() instead.',
    );
  }

  async verify(_userId: string, code: string, secret?: string): Promise<boolean> {
    if (!secret) return false;

    try {
      const decryptedSecret = this.decryptSecret(secret);
      const totp = new OTPAuth.TOTP({
        issuer: this.config.issuer,
        algorithm: this.config.algorithm ?? 'SHA1',
        digits: this.config.digits ?? 6,
        period: this.config.period ?? 30,
        secret: OTPAuth.Secret.fromBase32(decryptedSecret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      return delta !== null;
    } catch (error) {
      this.logger.error('TOTP verification failed', error);
      return false;
    }
  }

  async createSetup(userId: string): Promise<TotpSetupResult & { encryptedSecret: string }> {
    const secret = new OTPAuth.Secret({ size: 20 });

    const totp = new OTPAuth.TOTP({
      issuer: this.config.issuer,
      label: userId,
      algorithm: this.config.algorithm ?? 'SHA1',
      digits: this.config.digits ?? 6,
      period: this.config.period ?? 30,
      secret,
    });

    const otpAuthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    const encryptedSecret = this.encryptSecret(secret.base32);

    const backupCodesCount = this.config.backupCodesCount ?? 10;
    const backupCodes = Array.from({ length: backupCodesCount }, () =>
      crypto.randomBytes(4).toString('hex'),
    );

    return {
      secret: secret.base32,
      otpAuthUrl,
      qrCodeDataUrl,
      backupCodes,
      encryptedSecret,
    };
  }

  encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decryptSecret(encryptedSecret: string): string {
    const parts = encryptedSecret.split(':');
    const ivHex = parts[0]!;
    const authTagHex = parts[1]!;
    const encrypted = parts[2]!;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(authTag);
    const decryptedBuf = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'hex')),
      decipher.final(),
    ]);
    return decryptedBuf.toString('utf8');
  }
}

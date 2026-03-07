import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleOptions,
  TotpSetupResult,
  OtpVerifyResult,
} from './interfaces';
import { OTP_EVENTS } from './events';
import { TotpProvider } from './providers/totp.provider';
import { SmsOtpProvider } from './providers/sms-otp.provider';
import { EmailOtpProvider } from './providers/email-otp.provider';

@Injectable()
export class OtpService {
  private readonly prisma: any;
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(OTP_MODULE_OPTIONS)
    private readonly options: OtpModuleOptions,
    @Inject('PRISMA_SERVICE')
    prisma: any,
    @Optional()
    private readonly totpProvider?: TotpProvider,
    @Optional()
    private readonly smsOtpProvider?: SmsOtpProvider,
    @Optional()
    private readonly emailOtpProvider?: EmailOtpProvider,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {
    this.prisma = prisma;
  }

  async setupTotp(userId: string): Promise<TotpSetupResult> {
    if (!this.isMethodEnabled('totp') || !this.totpProvider) {
      throw new ForbiddenException('TOTP is not enabled');
    }

    const existing = await this.prisma.otpSecret.findUnique({
      where: { userId_method: { userId, method: 'totp' } },
    });

    if (existing?.isActive) {
      throw new BadRequestException('TOTP is already set up for this user');
    }

    const setup = await this.totpProvider.createSetup(userId);

    const backupCodeHashes = await Promise.all(
      setup.backupCodes.map((code: string) => bcrypt.hash(code, 10)),
    );

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.otpSecret.update({
          where: { id: existing.id },
          data: { encryptedSecret: setup.encryptedSecret, isActive: false },
        }),
        this.prisma.otpBackupCode.deleteMany({ where: { userId } }),
        ...backupCodeHashes.map((codeHash: string) =>
          this.prisma.otpBackupCode.create({
            data: { userId, codeHash },
          }),
        ),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.otpSecret.create({
          data: {
            userId,
            method: 'totp',
            encryptedSecret: setup.encryptedSecret,
            isActive: false,
          },
        }),
        ...backupCodeHashes.map((codeHash: string) =>
          this.prisma.otpBackupCode.create({
            data: { userId, codeHash },
          }),
        ),
      ]);
    }

    this.emitEvent(OTP_EVENTS.TOTP_SETUP, {
      userId,
      otpAuthUrl: setup.otpAuthUrl,
      qrCodeDataUrl: setup.qrCodeDataUrl,
      secret: setup.secret,
    });

    return {
      secret: setup.secret,
      otpAuthUrl: setup.otpAuthUrl,
      qrCodeDataUrl: setup.qrCodeDataUrl,
      backupCodes: setup.backupCodes,
    };
  }

  async confirmTotpSetup(
    userId: string,
    code: string,
  ): Promise<{ success: boolean }> {
    if (!this.isMethodEnabled('totp') || !this.totpProvider) {
      throw new ForbiddenException('TOTP is not enabled');
    }

    const otpSecret = await this.prisma.otpSecret.findUnique({
      where: { userId_method: { userId, method: 'totp' } },
    });

    if (!otpSecret) {
      throw new BadRequestException('TOTP setup not initiated');
    }

    if (otpSecret.isActive) {
      throw new BadRequestException('TOTP is already confirmed');
    }

    const isValid = await this.totpProvider.verify(
      userId,
      code,
      otpSecret.encryptedSecret,
    );

    if (!isValid) {
      this.emitEvent(OTP_EVENTS.FAILED, {
        userId,
        method: 'totp',
        reason: 'invalid_code',
      });
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.otpSecret.update({
      where: { id: otpSecret.id },
      data: { isActive: true },
    });

    this.emitEvent(OTP_EVENTS.TOTP_CONFIRMED, { userId });

    return { success: true };
  }

  async sendOtp(
    userId: string,
    method: 'sms' | 'email',
    options?: { context?: string },
  ): Promise<{ success: boolean; expiresAt: Date }> {
    const provider = method === 'sms' ? this.smsOtpProvider : this.emailOtpProvider;
    const methodKey = method === 'sms' ? 'smsOtp' : 'emailOtp';

    if (!this.isFeatureEnabled(methodKey) || !provider) {
      throw new ForbiddenException(`${method} OTP is not enabled`);
    }

    if (this.isFeatureEnabled('rateLimiting')) {
      await this.checkRateLimit(userId, method);
    }

    const result = await provider.generate(userId, options?.context);
    const codeHash = await provider.hashCode(result.code);

    await this.prisma.otpCode.create({
      data: {
        userId,
        method,
        codeHash,
        context: options?.context,
        expiresAt: result.expiresAt!,
      },
    });

    this.emitEvent(OTP_EVENTS.CODE_GENERATED, {
      userId,
      method,
      code: result.code,
      context: options?.context,
      expiresAt: result.expiresAt!,
    });

    return { success: true, expiresAt: result.expiresAt! };
  }

  async verifyOtp(
    userId: string,
    code: string,
    options?: { method?: 'totp' | 'sms' | 'email' | 'backup'; context?: string },
  ): Promise<OtpVerifyResult> {
    if (this.isFeatureEnabled('rateLimiting')) {
      await this.checkRateLimit(userId, options?.method ?? 'any');
    }

    if (options?.method === 'backup') {
      const success = await this.verifyBackupCode(userId, code);
      await this.recordAttempt(userId, 'backup', success);
      if (success) {
        this.emitEvent(OTP_EVENTS.VERIFIED, {
          userId,
          method: 'backup',
          context: options?.context,
        });
      }
      return { success, method: 'backup' };
    }

    if (options?.method === 'totp' || (!options?.method && this.isMethodEnabled('totp'))) {
      const success = await this.verifyTotp(userId, code);
      if (success) {
        await this.recordAttempt(userId, 'totp', true);
        this.emitEvent(OTP_EVENTS.VERIFIED, {
          userId,
          method: 'totp',
          context: options?.context,
        });
        return { success: true, method: 'totp' };
      }
      if (options?.method === 'totp') {
        await this.recordAttempt(userId, 'totp', false);
        this.emitEvent(OTP_EVENTS.FAILED, {
          userId,
          method: 'totp',
          reason: 'invalid_code',
          context: options?.context,
        });
        return { success: false, method: 'totp' };
      }
    }

    if (
      options?.method === 'sms' ||
      options?.method === 'email' ||
      !options?.method
    ) {
      const method = options?.method as 'sms' | 'email' | undefined;
      const success = await this.verifyCodeOtp(userId, code, method, options?.context);
      if (success.success) {
        await this.recordAttempt(userId, success.method, true);
        this.emitEvent(OTP_EVENTS.VERIFIED, {
          userId,
          method: success.method,
          context: options?.context,
        });
        return success;
      }
    }

    await this.recordAttempt(userId, options?.method ?? 'unknown', false);
    this.emitEvent(OTP_EVENTS.FAILED, {
      userId,
      method: options?.method ?? 'unknown',
      reason: 'invalid_code',
      context: options?.context,
    });

    return { success: false, method: options?.method ?? 'unknown' };
  }

  async generateBackupCodes(userId: string): Promise<string[]> {
    if (!this.isFeatureEnabled('backupCodes')) {
      throw new ForbiddenException('Backup codes are not enabled');
    }

    const totpConfig = this.options.methods.totp;
    const count =
      totpConfig && 'backupCodesCount' in totpConfig
        ? totpConfig.backupCodesCount ?? 10
        : 10;

    const codes = Array.from({ length: count }, () =>
      require('crypto').randomBytes(4).toString('hex'),
    );

    const codeHashes = await Promise.all(
      codes.map((code) => bcrypt.hash(code, 10)),
    );

    await this.prisma.$transaction([
      this.prisma.otpBackupCode.deleteMany({ where: { userId } }),
      ...codeHashes.map((codeHash: string) =>
        this.prisma.otpBackupCode.create({
          data: { userId, codeHash },
        }),
      ),
    ]);

    return codes;
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    if (!this.isFeatureEnabled('backupCodes')) {
      return false;
    }

    const backupCodes = await this.prisma.otpBackupCode.findMany({
      where: { userId, usedAt: null },
    });

    for (const backupCode of backupCodes) {
      const isMatch = await bcrypt.compare(code, backupCode.codeHash);
      if (isMatch) {
        await this.prisma.otpBackupCode.update({
          where: { id: backupCode.id },
          data: { usedAt: new Date() },
        });
        return true;
      }
    }

    return false;
  }

  async regenerateBackupCodes(
    userId: string,
    verificationCode: string,
  ): Promise<string[]> {
    const verifyResult = await this.verifyOtp(userId, verificationCode);
    if (!verifyResult.success) {
      throw new BadRequestException('Invalid verification code');
    }

    const codes = await this.generateBackupCodes(userId);

    this.emitEvent(OTP_EVENTS.BACKUP_CODES_REGENERATED, { userId });

    return codes;
  }

  async disableMethod(
    userId: string,
    method: 'totp' | 'sms' | 'email',
    verificationCode: string,
  ): Promise<void> {
    const verifyResult = await this.verifyOtp(userId, verificationCode);
    if (!verifyResult.success) {
      throw new BadRequestException('Invalid verification code');
    }

    if (method === 'totp') {
      await this.prisma.$transaction([
        this.prisma.otpSecret.deleteMany({
          where: { userId, method: 'totp' },
        }),
        this.prisma.otpBackupCode.deleteMany({ where: { userId } }),
      ]);
    } else {
      await this.prisma.otpCode.deleteMany({
        where: { userId, method },
      });
    }

    this.emitEvent(OTP_EVENTS.DISABLED, { userId, method });
  }

  async getEnabledMethods(userId: string): Promise<string[]> {
    const methods: string[] = [];

    const otpSecret = await this.prisma.otpSecret.findUnique({
      where: { userId_method: { userId, method: 'totp' } },
    });
    if (otpSecret?.isActive) {
      methods.push('totp');
    }

    const recentSmsCode = await this.prisma.otpCode.findFirst({
      where: { userId, method: 'sms' },
      orderBy: { createdAt: 'desc' },
    });
    if (recentSmsCode && this.isMethodEnabled('sms')) {
      methods.push('sms');
    }

    const recentEmailCode = await this.prisma.otpCode.findFirst({
      where: { userId, method: 'email' },
      orderBy: { createdAt: 'desc' },
    });
    if (recentEmailCode && this.isMethodEnabled('email')) {
      methods.push('email');
    }

    return methods;
  }

  async isOtpEnabled(userId: string): Promise<boolean> {
    const methods = await this.getEnabledMethods(userId);
    return methods.length > 0;
  }

  private async verifyTotp(userId: string, code: string): Promise<boolean> {
    if (!this.totpProvider) return false;

    const otpSecret = await this.prisma.otpSecret.findUnique({
      where: { userId_method: { userId, method: 'totp' } },
    });

    if (!otpSecret?.isActive) return false;

    return this.totpProvider.verify(userId, code, otpSecret.encryptedSecret);
  }

  private async verifyCodeOtp(
    userId: string,
    code: string,
    method?: 'sms' | 'email',
    context?: string,
  ): Promise<OtpVerifyResult> {
    const whereClause: any = {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    };

    if (method) whereClause.method = method;
    if (context) whereClause.context = context;

    const otpCodes = await this.prisma.otpCode.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const otpCode of otpCodes) {
      const provider =
        otpCode.method === 'sms' ? this.smsOtpProvider : this.emailOtpProvider;
      if (!provider) continue;

      const isValid = await provider.verify(userId, code, otpCode.codeHash);
      if (isValid) {
        await this.prisma.otpCode.update({
          where: { id: otpCode.id },
          data: { usedAt: new Date() },
        });
        return { success: true, method: otpCode.method };
      }
    }

    return { success: false, method: method ?? 'unknown' };
  }

  private async checkRateLimit(userId: string, method: string): Promise<void> {
    const config = this.options.rateLimiting;
    const maxAttempts = config?.maxAttempts ?? 5;
    const windowSeconds = config?.windowSeconds ?? 300;
    const lockoutSeconds = config?.lockoutSeconds ?? 900;

    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    const recentAttempts = await this.prisma.otpAttempt.count({
      where: {
        userId,
        method: method === 'any' ? undefined : method,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    if (recentAttempts >= maxAttempts) {
      const lastAttempt = await this.prisma.otpAttempt.findFirst({
        where: {
          userId,
          method: method === 'any' ? undefined : method,
          success: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (lastAttempt) {
        const lockoutEnd = new Date(
          lastAttempt.createdAt.getTime() + lockoutSeconds * 1000,
        );
        if (new Date() < lockoutEnd) {
          this.emitEvent(OTP_EVENTS.FAILED, {
            userId,
            method,
            reason: 'rate_limited',
          });
          throw new ForbiddenException(
            'Too many attempts. Please try again later.',
          );
        }
      }
    }
  }

  private async recordAttempt(
    userId: string,
    method: string,
    success: boolean,
  ): Promise<void> {
    try {
      await this.prisma.otpAttempt.create({
        data: { userId, method, success },
      });
    } catch (error) {
      this.logger.error('Failed to record OTP attempt', error);
    }
  }

  private isMethodEnabled(method: 'totp' | 'sms' | 'email'): boolean {
    const config = this.options.methods[method];
    return !!config && ('enabled' in config ? config.enabled !== false : true);
  }

  private isFeatureEnabled(
    feature: keyof NonNullable<OtpModuleOptions['features']>,
  ): boolean {
    return this.options.features?.[feature] !== false;
  }

  private emitEvent(event: string, payload: Record<string, unknown>): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, payload);
    }
  }
}

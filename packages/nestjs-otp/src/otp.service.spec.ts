import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { OtpService } from './otp.service';
import { OTP_MODULE_OPTIONS, OtpModuleOptions } from './interfaces';
import { OTP_EVENTS } from './events';
import { TotpProvider } from './providers/totp.provider';
import { SmsOtpProvider } from './providers/sms-otp.provider';
import { EmailOtpProvider } from './providers/email-otp.provider';

const defaultOptions: OtpModuleOptions = {
  encryptionKey: 'test-encryption-key-32-chars-long',
  methods: {
    totp: {
      enabled: true,
      method: 'totp',
      issuer: 'TestApp',
      backupCodesCount: 8,
    },
    sms: {
      enabled: true,
      method: 'sms',
      codeLength: 6,
      expiresInSeconds: 300,
    },
    email: {
      enabled: true,
      method: 'email',
      codeLength: 6,
      expiresInSeconds: 600,
    },
  },
  features: {
    totp: true,
    smsOtp: true,
    emailOtp: true,
    rateLimiting: true,
    backupCodes: true,
  },
  rateLimiting: {
    maxAttempts: 5,
    windowSeconds: 300,
    lockoutSeconds: 900,
  },
};

const mockPrismaService = {
  otpSecret: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  otpBackupCode: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  otpAttempt: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  otpCode: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockTotpProvider = {
  createSetup: jest.fn(),
  verify: jest.fn(),
  generate: jest.fn(),
  encryptSecret: jest.fn(),
  decryptSecret: jest.fn(),
};

const mockSmsProvider = {
  generate: jest.fn(),
  verify: jest.fn(),
  hashCode: jest.fn(),
};

const mockEmailProvider = {
  generate: jest.fn(),
  verify: jest.fn(),
  hashCode: jest.fn(),
};

describe('OtpService', () => {
  let service: OtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: OTP_MODULE_OPTIONS, useValue: defaultOptions },
        { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
        { provide: TotpProvider, useValue: mockTotpProvider },
        { provide: SmsOtpProvider, useValue: mockSmsProvider },
        { provide: EmailOtpProvider, useValue: mockEmailProvider },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    jest.clearAllMocks();
  });

  describe('setupTotp', () => {
    it('should setup TOTP for a new user', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue(null);
      mockTotpProvider.createSetup.mockResolvedValue({
        secret: 'BASE32SECRET',
        otpAuthUrl: 'otpauth://totp/TestApp:user-1?secret=BASE32SECRET',
        qrCodeDataUrl: 'data:image/png;base64,...',
        backupCodes: ['code1', 'code2', 'code3', 'code4', 'code5', 'code6', 'code7', 'code8'],
        encryptedSecret: 'encrypted-secret',
      });
      mockPrismaService.$transaction.mockResolvedValue([]);

      const result = await service.setupTotp('user-1');

      expect(result.secret).toBe('BASE32SECRET');
      expect(result.otpAuthUrl).toContain('otpauth://totp/');
      expect(result.qrCodeDataUrl).toContain('data:image/png');
      expect(result.backupCodes).toHaveLength(8);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OTP_EVENTS.TOTP_SETUP,
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('should throw if TOTP already active', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        id: 'secret-1',
        userId: 'user-1',
        method: 'totp',
        isActive: true,
      });

      await expect(service.setupTotp('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow re-setup if not active', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        id: 'secret-1',
        userId: 'user-1',
        method: 'totp',
        isActive: false,
      });
      mockTotpProvider.createSetup.mockResolvedValue({
        secret: 'NEW_SECRET',
        otpAuthUrl: 'otpauth://totp/TestApp:user-1?secret=NEW_SECRET',
        qrCodeDataUrl: 'data:image/png;base64,...',
        backupCodes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
        encryptedSecret: 'encrypted-new',
      });
      mockPrismaService.$transaction.mockResolvedValue([]);

      const result = await service.setupTotp('user-1');
      expect(result.secret).toBe('NEW_SECRET');
    });
  });

  describe('confirmTotpSetup', () => {
    it('should confirm TOTP setup with valid code', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        id: 'secret-1',
        userId: 'user-1',
        method: 'totp',
        encryptedSecret: 'encrypted-secret',
        isActive: false,
      });
      mockTotpProvider.verify.mockResolvedValue(true);
      mockPrismaService.otpSecret.update.mockResolvedValue({});

      const result = await service.confirmTotpSetup('user-1', '123456');

      expect(result.success).toBe(true);
      expect(mockPrismaService.otpSecret.update).toHaveBeenCalledWith({
        where: { id: 'secret-1' },
        data: { isActive: true },
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OTP_EVENTS.TOTP_CONFIRMED,
        { userId: 'user-1' },
      );
    });

    it('should throw on invalid TOTP code', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        id: 'secret-1',
        userId: 'user-1',
        method: 'totp',
        encryptedSecret: 'encrypted-secret',
        isActive: false,
      });
      mockTotpProvider.verify.mockResolvedValue(false);

      await expect(
        service.confirmTotpSetup('user-1', 'wrong'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if setup not initiated', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmTotpSetup('user-1', '123456'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendOtp', () => {
    it('should generate and store SMS OTP code', async () => {
      const expiresAt = new Date(Date.now() + 300000);
      mockSmsProvider.generate.mockResolvedValue({
        code: '123456',
        expiresAt,
      });
      mockSmsProvider.hashCode.mockResolvedValue('hashed-code');
      mockPrismaService.otpCode.create.mockResolvedValue({});
      mockPrismaService.otpAttempt.count.mockResolvedValue(0);

      const result = await service.sendOtp('user-1', 'sms');

      expect(result.success).toBe(true);
      expect(result.expiresAt).toEqual(expiresAt);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OTP_EVENTS.CODE_GENERATED,
        expect.objectContaining({
          userId: 'user-1',
          method: 'sms',
          code: '123456',
        }),
      );
    });

    it('should generate and store email OTP code', async () => {
      const expiresAt = new Date(Date.now() + 600000);
      mockEmailProvider.generate.mockResolvedValue({
        code: '654321',
        expiresAt,
      });
      mockEmailProvider.hashCode.mockResolvedValue('hashed-code');
      mockPrismaService.otpCode.create.mockResolvedValue({});
      mockPrismaService.otpAttempt.count.mockResolvedValue(0);

      const result = await service.sendOtp('user-1', 'email');

      expect(result.success).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OTP_EVENTS.CODE_GENERATED,
        expect.objectContaining({
          userId: 'user-1',
          method: 'email',
          code: '654321',
        }),
      );
    });

    it('should throw when rate limited', async () => {
      mockPrismaService.otpAttempt.count.mockResolvedValue(5);
      mockPrismaService.otpAttempt.findFirst.mockResolvedValue({
        createdAt: new Date(),
      });

      await expect(service.sendOtp('user-1', 'sms')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should verify TOTP code', async () => {
      mockPrismaService.otpAttempt.count.mockResolvedValue(0);
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        userId: 'user-1',
        method: 'totp',
        encryptedSecret: 'encrypted-secret',
        isActive: true,
      });
      mockTotpProvider.verify.mockResolvedValue(true);
      mockPrismaService.otpAttempt.create.mockResolvedValue({});

      const result = await service.verifyOtp('user-1', '123456', {
        method: 'totp',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('totp');
    });

    it('should verify SMS code', async () => {
      mockPrismaService.otpAttempt.count.mockResolvedValue(0);
      mockPrismaService.otpCode.findMany.mockResolvedValue([
        {
          id: 'code-1',
          userId: 'user-1',
          method: 'sms',
          codeHash: 'hashed-code',
          expiresAt: new Date(Date.now() + 300000),
          usedAt: null,
        },
      ]);
      mockSmsProvider.verify.mockResolvedValue(true);
      mockPrismaService.otpCode.update.mockResolvedValue({});
      mockPrismaService.otpAttempt.create.mockResolvedValue({});

      const result = await service.verifyOtp('user-1', '123456', {
        method: 'sms',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('sms');
    });

    it('should verify backup code', async () => {
      mockPrismaService.otpAttempt.count.mockResolvedValue(0);
      mockPrismaService.otpBackupCode.findMany.mockResolvedValue([
        { id: 'backup-1', userId: 'user-1', codeHash: 'hashed-backup', usedAt: null },
      ]);
      mockPrismaService.otpAttempt.create.mockResolvedValue({});

      // Mock bcrypt.compare to return true for backup code
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const result = await service.verifyOtp('user-1', 'backup-code', {
        method: 'backup',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('backup');
    });

    it('should return failure for invalid code', async () => {
      mockPrismaService.otpAttempt.count.mockResolvedValue(0);
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        userId: 'user-1',
        method: 'totp',
        encryptedSecret: 'encrypted-secret',
        isActive: true,
      });
      mockTotpProvider.verify.mockResolvedValue(false);
      mockPrismaService.otpAttempt.create.mockResolvedValue({});

      const result = await service.verifyOtp('user-1', 'wrong', {
        method: 'totp',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate backup codes', async () => {
      mockPrismaService.$transaction.mockResolvedValue([]);

      const codes = await service.generateBackupCodes('user-1');

      expect(codes).toHaveLength(8);
      codes.forEach((code: string) => {
        expect(typeof code).toBe('string');
        expect(code.length).toBe(8);
      });
    });

    it('should throw if backup codes disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OtpService,
          {
            provide: OTP_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, backupCodes: false },
            },
          },
          { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
          { provide: TotpProvider, useValue: mockTotpProvider },
          { provide: SmsOtpProvider, useValue: mockSmsProvider },
          { provide: EmailOtpProvider, useValue: mockEmailProvider },
          { provide: EventEmitter2, useValue: mockEventEmitter },
        ],
      }).compile();

      const svc = module.get<OtpService>(OtpService);

      await expect(svc.generateBackupCodes('user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('disableMethod', () => {
    it('should disable TOTP after verification', async () => {
      // Mock verifyOtp to succeed
      mockPrismaService.otpAttempt.count.mockResolvedValue(0);
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        userId: 'user-1',
        method: 'totp',
        encryptedSecret: 'encrypted',
        isActive: true,
      });
      mockTotpProvider.verify.mockResolvedValue(true);
      mockPrismaService.otpAttempt.create.mockResolvedValue({});
      mockPrismaService.$transaction.mockResolvedValue([]);

      await service.disableMethod('user-1', 'totp', '123456');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OTP_EVENTS.DISABLED,
        { userId: 'user-1', method: 'totp' },
      );
    });
  });

  describe('getEnabledMethods', () => {
    it('should return enabled methods for a user', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        userId: 'user-1',
        method: 'totp',
        isActive: true,
      });
      mockPrismaService.otpCode.findFirst
        .mockResolvedValueOnce({ id: 'code-1' }) // sms
        .mockResolvedValueOnce(null); // email

      const methods = await service.getEnabledMethods('user-1');

      expect(methods).toContain('totp');
      expect(methods).toContain('sms');
      expect(methods).not.toContain('email');
    });
  });

  describe('isOtpEnabled', () => {
    it('should return true when methods are enabled', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue({
        isActive: true,
      });
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      const result = await service.isOtpEnabled('user-1');
      expect(result).toBe(true);
    });

    it('should return false when no methods enabled', async () => {
      mockPrismaService.otpSecret.findUnique.mockResolvedValue(null);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      const result = await service.isOtpEnabled('user-1');
      expect(result).toBe(false);
    });
  });
});

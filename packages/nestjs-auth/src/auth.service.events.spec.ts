import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { AUTH_MODULE_OPTIONS, AuthModuleOptions } from './interfaces';
import { AUTH_EVENTS } from './events';

jest.mock('bcryptjs');

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  verificationToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const defaultOptions: AuthModuleOptions = {
  jwt: { secret: 'test-secret', expiresIn: '1h' },
  features: {
    emailPassword: true,
    emailVerification: true,
    passwordReset: true,
    sessionManagement: true,
    accountLinking: true,
  },
  passwordHashRounds: 10,
  verificationTokenExpiresIn: 86400,
};

describe('AuthService - Event Emission', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_MODULE_OPTIONS, useValue: defaultOptions },
        { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = { email: 'test@example.com', password: 'password123' };

    it('should emit auth.user.registered with verificationToken when emailVerification is enabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        isActive: true,
      });
      mockPrismaService.verificationToken.create.mockResolvedValue({});

      await service.register(registerDto);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AUTH_EVENTS.USER_REGISTERED,
        {
          userId: 'user-1',
          email: 'test@example.com',
          verificationToken: expect.any(String),
        },
      );

      expect(mockPrismaService.verificationToken.create).toHaveBeenCalledWith({
        data: {
          token: expect.any(String),
          type: 'email_verification',
          userId: 'user-1',
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should emit auth.user.registered without verificationToken when emailVerification is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, emailVerification: false },
            },
          },
          { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
          { provide: EventEmitter2, useValue: mockEventEmitter },
        ],
      }).compile();

      const svc = module.get<AuthService>(AuthService);
      jest.clearAllMocks();

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        isActive: true,
      });

      await svc.register(registerDto);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AUTH_EVENTS.USER_REGISTERED,
        {
          userId: 'user-1',
          email: 'test@example.com',
          verificationToken: undefined,
        },
      );

      expect(mockPrismaService.verificationToken.create).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should emit auth.password.forgot with resetToken when user exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrismaService.verificationToken.create.mockResolvedValue({});

      await service.forgotPassword('test@example.com');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AUTH_EVENTS.FORGOT_PASSWORD,
        {
          userId: 'user-1',
          email: 'test@example.com',
          resetToken: expect.any(String),
          expiresInSeconds: 86400,
        },
      );
    });

    it('should not emit event when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword('nonexistent@example.com');

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should emit auth.email.verified after successful verification', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'valid-token',
        type: 'email_verification',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      await service.verifyEmail('valid-token');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AUTH_EVENTS.EMAIL_VERIFIED,
        { userId: 'user-1' },
      );
    });
  });

  describe('resetPassword', () => {
    it('should emit auth.password.reset after successful reset', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'valid-token',
        type: 'password_reset',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      await service.resetPassword('valid-token', 'newPassword123');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AUTH_EVENTS.PASSWORD_RESET,
        { userId: 'user-1', email: '' },
      );
    });
  });

  describe('without EventEmitter', () => {
    it('should not throw when EventEmitter is not injected', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: AUTH_MODULE_OPTIONS, useValue: defaultOptions },
          { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const svc = module.get<AuthService>(AuthService);
      jest.clearAllMocks();

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        isActive: true,
      });
      mockPrismaService.verificationToken.create.mockResolvedValue({});

      await expect(svc.register({ email: 'test@example.com', password: 'pass123' })).resolves.toBeDefined();
    });
  });
});

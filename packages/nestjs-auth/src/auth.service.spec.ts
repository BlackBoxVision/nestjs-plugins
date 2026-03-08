import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';

import { PRISMA_SERVICE, createMockPrismaService, MockPrismaService } from '@bbv/nestjs-prisma';
import { AuthService } from './auth.service';
import { AUTH_MODULE_OPTIONS, AuthModuleOptions } from './interfaces';

jest.mock('bcryptjs');

const mockPrismaService = createMockPrismaService();

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

const defaultOptions: AuthModuleOptions = {
  jwt: { secret: 'test-secret', expiresIn: '1h' },
  features: {
    emailPassword: true,
    emailVerification: true,
    passwordReset: true,
    sessionManagement: true,
    accountLinking: true,
    organizations: true,
  },
  passwordHashRounds: 10,
  verificationTokenExpiresIn: 86400,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_MODULE_OPTIONS, useValue: defaultOptions },
        { provide: PRISMA_SERVICE, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = { email: 'test@example.com', password: 'password123' };

    it('should register a new user and return access token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        isActive: true,
      });

      const result = await service.register(registerDto);

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          role: 'user',
          accounts: {
            create: { provider: 'credentials' },
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          isActive: true,
        },
      });
    });

    it('should throw BadRequestException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if emailPassword feature is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { emailPassword: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(restrictedService.register(registerDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };

    it('should login and return user with access token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        emailVerified: true,
        isActive: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        emailVerified: true,
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateUser', () => {
    it('should return authenticated user when credentials are valid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        emailVerified: true,
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        isActive: true,
      });
    });

    it('should return null when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });

    it('should return null when user has no password hash', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: null,
        emailVerified: true,
        isActive: true,
      });

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });

    it('should return null when user is not active', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        emailVerified: true,
        isActive: false,
      });

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });

    it('should return null when password does not match', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        emailVerified: true,
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrong-password',
      );

      expect(result).toBeNull();
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token with correct payload including emailVerified and isActive', () => {
      const user = { id: 'user-1', email: 'test@example.com' };

      const token = service.generateToken(user);

      expect(token).toBe('mock-jwt-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        isActive: true,
      });
    });

    it('should include emailVerified and isActive from user when provided', () => {
      const user = { id: 'user-1', email: 'test@example.com', role: 'admin', emailVerified: true, isActive: true };

      service.generateToken(user);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@example.com',
        role: 'admin',
        emailVerified: true,
        isActive: true,
      });
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const mockToken = {
        id: 'token-1',
        token: 'valid-token',
        type: 'email_verification',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      };

      mockPrismaService.verificationToken.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.verifyEmail('valid-token');

      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'expired-token',
        type: 'email_verification',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 86400000),
        usedAt: null,
      });

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for already used token', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'used-token',
        type: 'email_verification',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: new Date(),
      });

      await expect(service.verifyEmail('used-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should create a verification token for existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrismaService.verificationToken.create.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com');

      expect(result.success).toBe(true);
      expect(mockPrismaService.verificationToken.create).toHaveBeenCalledWith({
        data: {
          token: expect.any(String),
          type: 'password_reset',
          userId: 'user-1',
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should return success even if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result.success).toBe(true);
      expect(mockPrismaService.verificationToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
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

      const result = await service.resetPassword('valid-token', 'newPassword123');

      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
    });
  });

  describe('login - feature disabled', () => {
    it('should throw ForbiddenException if emailPassword feature is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, emailPassword: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(
        restrictedService.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyEmail - feature disabled', () => {
    it('should throw ForbiddenException if emailVerification feature is disabled', async () => {
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
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(restrictedService.verifyEmail('some-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for wrong token type', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'wrong-type-token',
        type: 'password_reset',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });

      await expect(service.verifyEmail('wrong-type-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword - feature disabled', () => {
    it('should throw ForbiddenException if passwordReset feature is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, passwordReset: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(
        restrictedService.forgotPassword('test@example.com'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resetPassword - additional paths', () => {
    it('should throw ForbiddenException if passwordReset feature is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, passwordReset: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(
        restrictedService.resetPassword('some-token', 'newPass123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'newPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already used token', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'used-token',
        type: 'password_reset',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: new Date(),
      });

      await expect(
        service.resetPassword('used-token', 'newPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'expired-token',
        type: 'password_reset',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 86400000),
        usedAt: null,
      });

      await expect(
        service.resetPassword('expired-token', 'newPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for wrong token type', async () => {
      mockPrismaService.verificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'wrong-type-token',
        type: 'email_verification',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });

      await expect(
        service.resetPassword('wrong-type-token', 'newPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should hash new password and update user and token via $transaction', async () => {
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
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.verificationToken.update.mockResolvedValue({});

      const result = await service.resetPassword('valid-token', 'newPassword123');

      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOrCreateSocialUser', () => {
    const socialProfile = {
      providerAccountId: 'google-123',
      email: 'social@example.com',
      displayName: 'Social User',
      avatarUrl: 'https://example.com/avatar.png',
      accessToken: 'social-access-token',
      refreshToken: 'social-refresh-token',
    };

    it('should update tokens and return user when account already exists', async () => {
      const existingAccount = {
        id: 'account-1',
        provider: 'google',
        providerAccountId: 'google-123',
        user: {
          id: 'user-1',
          email: 'social@example.com',
          emailVerified: true,
          isActive: true,
        },
      };

      mockPrismaService.account.findUnique.mockResolvedValue(existingAccount);
      mockPrismaService.account.update.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.findOrCreateSocialUser('google', socialProfile);

      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('social@example.com');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: {
          accessToken: 'social-access-token',
          refreshToken: 'social-refresh-token',
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should link account to existing user when accountLinking is enabled', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'social@example.com',
        emailVerified: false,
        isActive: true,
        avatarUrl: null,
      };

      mockPrismaService.account.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.account.create.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.findOrCreateSocialUser('google', socialProfile);

      expect(result.user.id).toBe('user-1');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          provider: 'google',
          providerAccountId: 'google-123',
          accessToken: 'social-access-token',
          refreshToken: 'social-refresh-token',
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          emailVerified: true,
          lastLoginAt: expect.any(Date),
          avatarUrl: 'https://example.com/avatar.png',
        },
      });
    });

    it('should create new user with social account when no user exists', async () => {
      const createdUser = {
        id: 'user-new',
        email: 'social@example.com',
        emailVerified: true,
        isActive: true,
      };

      mockPrismaService.account.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.findOrCreateSocialUser('google', socialProfile);

      expect(result.user.id).toBe('user-new');
      expect(result.user.email).toBe('social@example.com');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'social@example.com',
          emailVerified: true,
          avatarUrl: 'https://example.com/avatar.png',
          lastLoginAt: expect.any(Date),
          accounts: {
            create: {
              provider: 'google',
              providerAccountId: 'google-123',
              accessToken: 'social-access-token',
              refreshToken: 'social-refresh-token',
            },
          },
        },
      });
    });

    it('should throw BadRequestException when user exists but accountLinking is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, accountLinking: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      mockPrismaService.account.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'social@example.com',
        emailVerified: true,
        isActive: true,
      });

      await expect(
        restrictedService.findOrCreateSocialUser('google', socialProfile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      mockPrismaService.session.create.mockResolvedValue({
        id: 'session-1',
        token: 'session-token',
        expiresAt: new Date(),
      });

      const result = await service.createSession(
        'user-1',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result.id).toBe('session-1');
      expect(mockPrismaService.session.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          token: expect.any(String),
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should throw ForbiddenException if sessionManagement feature is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, sessionManagement: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(
        restrictedService.createSession('user-1', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeSession', () => {
    it('should throw ForbiddenException if sessionManagement feature is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, sessionManagement: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(
        restrictedService.revokeSession('session-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when session is not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeSession('nonexistent-session', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when session belongs to a different user', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-2',
      });

      await expect(
        service.revokeSession('session-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete session when session exists and belongs to user', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });
      mockPrismaService.session.delete.mockResolvedValue({});

      await service.revokeSession('session-1', 'user-1');

      expect(mockPrismaService.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });

  describe('getUserSessions', () => {
    it('should throw ForbiddenException if sessionManagement feature is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_MODULE_OPTIONS,
            useValue: {
              ...defaultOptions,
              features: { ...defaultOptions.features, sessionManagement: false },
            },
          },
          { provide: PRISMA_SERVICE, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      const restrictedService = module.get<AuthService>(AuthService);

      await expect(
        restrictedService.getUserSessions('user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return sessions for a user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      ];

      mockPrismaService.session.findMany.mockResolvedValue(mockSessions);

      const result = await service.getUserSessions('user-1');

      expect(result).toEqual(mockSessions);
      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          expiresAt: { gt: expect.any(Date) },
        },
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile when user is found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        isActive: true,
      });

      const result = await service.getProfile('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        isActive: true,
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          isActive: true,
        },
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

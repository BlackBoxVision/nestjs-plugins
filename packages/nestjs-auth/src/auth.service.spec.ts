import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { AUTH_MODULE_OPTIONS, AuthModuleOptions } from './interfaces';

jest.mock('bcryptjs');

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
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
        { provide: 'PrismaService', useValue: mockPrismaService },
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
          accounts: {
            create: { provider: 'credentials' },
          },
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
          { provide: 'PrismaService', useValue: mockPrismaService },
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
    it('should generate a JWT token with correct payload', () => {
      const user = { id: 'user-1', email: 'test@example.com' };

      const token = service.generateToken(user);

      expect(token).toBe('mock-jwt-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@example.com',
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
  });
});

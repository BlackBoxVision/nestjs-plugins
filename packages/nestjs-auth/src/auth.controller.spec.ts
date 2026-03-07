import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_MODULE_OPTIONS, AuthModuleOptions } from './interfaces';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    verifyEmail: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    getProfile: jest.fn(),
    getUserSessions: jest.fn(),
    revokeSession: jest.fn(),
    findOrCreateSocialUser: jest.fn(),
  };

  const mockOptions: AuthModuleOptions = {
    jwt: { secret: 'test-secret', expiresIn: '1h' },
    features: { emailPassword: true },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AUTH_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = mockAuthService as any;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /register', () => {
    it('should call authService.register with the dto', async () => {
      const dto = { email: 'user@test.com', password: 'P@ssw0rd!' };
      const expected = {
        user: { id: 'u1', email: dto.email, emailVerified: false, isActive: true },
        accessToken: 'jwt-token',
      };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /login', () => {
    it('should call authService.login with the dto', async () => {
      const dto = { email: 'user@test.com', password: 'P@ssw0rd!' };
      const expected = {
        user: { id: 'u1', email: dto.email, emailVerified: true, isActive: true },
        accessToken: 'jwt-token',
      };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /verify-email', () => {
    it('should call authService.verifyEmail with dto.token', async () => {
      const dto = { token: 'verification-token-abc' };
      const expected = { success: true };
      mockAuthService.verifyEmail.mockResolvedValue(expected);

      const result = await controller.verifyEmail(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(dto.token);
    });
  });

  describe('POST /forgot-password', () => {
    it('should call authService.forgotPassword with dto.email', async () => {
      const dto = { email: 'user@test.com' };
      const expected = { success: true };
      mockAuthService.forgotPassword.mockResolvedValue(expected);

      const result = await controller.forgotPassword(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto.email);
    });
  });

  describe('POST /reset-password', () => {
    it('should call authService.resetPassword with dto.token and dto.newPassword', async () => {
      const dto = { token: 'reset-token-xyz', newPassword: 'NewP@ssw0rd!' };
      const expected = { success: true };
      mockAuthService.resetPassword.mockResolvedValue(expected);

      const result = await controller.resetPassword(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        dto.token,
        dto.newPassword,
      );
    });
  });

  describe('GET /me', () => {
    it('should call authService.getProfile with user.id', async () => {
      const user = { id: 'u1', email: 'test@test.com', emailVerified: true, isActive: true };
      const expected = { id: 'u1', email: 'test@test.com', emailVerified: true, isActive: true };
      mockAuthService.getProfile.mockResolvedValue(expected);

      const result = await controller.me(user);

      expect(result).toEqual(expected);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('u1');
    });
  });

  describe('GET /sessions', () => {
    it('should call authService.getUserSessions with user.id', async () => {
      const user = { id: 'u1', email: 'test@test.com', emailVerified: true, isActive: true };
      const expected = [
        { id: 's1', ipAddress: '127.0.0.1', userAgent: 'Chrome', createdAt: new Date(), expiresAt: new Date() },
      ];
      mockAuthService.getUserSessions.mockResolvedValue(expected);

      const result = await controller.listSessions(user);

      expect(result).toEqual(expected);
      expect(mockAuthService.getUserSessions).toHaveBeenCalledWith('u1');
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('should call authService.revokeSession and return { success: true }', async () => {
      const user = { id: 'u1', email: 'test@test.com', emailVerified: true, isActive: true };
      const sessionId = 'session-123';
      mockAuthService.revokeSession.mockResolvedValue(undefined);

      const result = await controller.revokeSession(sessionId, user);

      expect(result).toEqual({ success: true });
      expect(mockAuthService.revokeSession).toHaveBeenCalledWith(sessionId, 'u1');
    });

    it('should pass correct sessionId and user.id', async () => {
      const user = { id: 'u2', email: 'other@test.com', emailVerified: true, isActive: true };
      const sessionId = 'another-session-456';
      mockAuthService.revokeSession.mockResolvedValue(undefined);

      await controller.revokeSession(sessionId, user);

      expect(mockAuthService.revokeSession).toHaveBeenCalledWith(
        'another-session-456',
        'u2',
      );
    });
  });

  describe('GET /google/callback', () => {
    it('should call authService.findOrCreateSocialUser with google profile', async () => {
      const req = {
        user: {
          providerAccountId: 'google-123',
          email: 'google@test.com',
          displayName: 'Google User',
          avatarUrl: 'https://photo.url/pic.jpg',
          accessToken: 'google-at',
          refreshToken: 'google-rt',
        },
      };
      const expected = {
        user: { id: 'u1', email: 'google@test.com', emailVerified: true, isActive: true },
        accessToken: 'jwt-token',
      };
      mockAuthService.findOrCreateSocialUser.mockResolvedValue(expected);

      const result = await controller.googleCallback(req);

      expect(result).toEqual(expected);
      expect(mockAuthService.findOrCreateSocialUser).toHaveBeenCalledWith('google', {
        providerAccountId: 'google-123',
        email: 'google@test.com',
        displayName: 'Google User',
        avatarUrl: 'https://photo.url/pic.jpg',
        accessToken: 'google-at',
        refreshToken: 'google-rt',
      });
    });
  });
});

import { AuthNotificationListener } from './auth-notification.listener';
import { AuthNotificationConfig } from './auth-notification.interfaces';

const mockNotificationService = {
  send: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};

const mockTemplateService = {
  render: jest.fn().mockReturnValue('<html>rendered</html>'),
};

const defaultConfig: AuthNotificationConfig = {
  baseUrl: 'https://myapp.com',
  appName: 'Test App',
};

describe('AuthNotificationListener', () => {
  let listener: AuthNotificationListener;

  beforeEach(() => {
    listener = new AuthNotificationListener(
      defaultConfig,
      mockNotificationService as any,
      mockTemplateService as any,
    );

    jest.clearAllMocks();
  });

  describe('handleUserRegistered', () => {
    it('should send verify-email when verificationToken is present', async () => {
      await listener.handleUserRegistered({
        userId: 'user-1',
        email: 'test@example.com',
        verificationToken: 'abc123',
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        'verify-email',
        'email',
        { verifyUrl: 'https://myapp.com/auth/verify-email?token=abc123' },
      );

      expect(mockNotificationService.send).toHaveBeenCalledWith({
        userId: 'user-1',
        channel: 'email',
        type: 'auth.verify-email',
        title: 'Verify Your Email Address',
        body: '<html>rendered</html>',
        to: 'test@example.com',
      });
    });

    it('should send welcome email when no verificationToken', async () => {
      await listener.handleUserRegistered({
        userId: 'user-1',
        email: 'test@example.com',
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        'welcome',
        'email',
        { name: 'test@example.com', actionUrl: 'https://myapp.com' },
      );

      expect(mockNotificationService.send).toHaveBeenCalledWith({
        userId: 'user-1',
        channel: 'email',
        type: 'auth.welcome',
        title: 'Welcome to Test App',
        body: '<html>rendered</html>',
        to: 'test@example.com',
      });
    });
  });

  describe('handleForgotPassword', () => {
    it('should send password-reset email with correct URL', async () => {
      await listener.handleForgotPassword({
        userId: 'user-1',
        email: 'test@example.com',
        resetToken: 'reset-abc',
        expiresInSeconds: 86400,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        'password-reset',
        'email',
        {
          resetUrl: 'https://myapp.com/auth/reset-password?token=reset-abc',
          expiresIn: '24 hours',
        },
      );

      expect(mockNotificationService.send).toHaveBeenCalledWith({
        userId: 'user-1',
        channel: 'email',
        type: 'auth.password-reset',
        title: 'Reset Your Password',
        body: '<html>rendered</html>',
        to: 'test@example.com',
      });
    });

    it('should use "1 hour" when expiresInSeconds is 3600', async () => {
      await listener.handleForgotPassword({
        userId: 'user-1',
        email: 'test@example.com',
        resetToken: 'reset-abc',
        expiresInSeconds: 3600,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        'password-reset',
        'email',
        {
          resetUrl: 'https://myapp.com/auth/reset-password?token=reset-abc',
          expiresIn: '1 hour',
        },
      );
    });
  });

  describe('config defaults', () => {
    it('should use custom paths when configured', async () => {
      const customListener = new AuthNotificationListener(
        {
          baseUrl: 'https://custom.com',
          verifyEmailPath: '/verify?t={{token}}',
          resetPasswordPath: '/reset?t={{token}}',
          templates: {
            welcome: 'custom-welcome',
            verifyEmail: 'custom-verify',
            passwordReset: 'custom-reset',
          },
        },
        mockNotificationService as any,
        mockTemplateService as any,
      );

      await customListener.handleUserRegistered({
        userId: 'user-1',
        email: 'test@example.com',
        verificationToken: 'tok123',
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        'custom-verify',
        'email',
        { verifyUrl: 'https://custom.com/verify?t=tok123' },
      );

      jest.clearAllMocks();

      await customListener.handleForgotPassword({
        userId: 'user-1',
        email: 'test@example.com',
        resetToken: 'rst456',
        expiresInSeconds: 7200,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        'custom-reset',
        'email',
        {
          resetUrl: 'https://custom.com/reset?t=rst456',
          expiresIn: '2 hours',
        },
      );
    });

    it('should default appName to "Our App"', async () => {
      const noNameListener = new AuthNotificationListener(
        { baseUrl: 'https://test.com' },
        mockNotificationService as any,
        mockTemplateService as any,
      );

      await noNameListener.handleUserRegistered({
        userId: 'user-1',
        email: 'test@example.com',
      });

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Welcome to Our App',
        }),
      );
    });
  });
});

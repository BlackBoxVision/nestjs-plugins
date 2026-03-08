export interface AuthNotificationConfig {
  baseUrl: string;
  verifyEmailPath?: string;
  resetPasswordPath?: string;
  appName?: string;
  templates?: {
    welcome?: string;
    verifyEmail?: string;
    passwordReset?: string;
  };
}

export interface AuthNotificationAsyncOptions {
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<AuthNotificationConfig> | AuthNotificationConfig;
  inject?: any[];
}

export const AUTH_NOTIFICATION_CONFIG = 'AUTH_NOTIFICATION_CONFIG';

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  verificationToken?: string;
}

export interface ForgotPasswordEvent {
  userId: string;
  email: string;
  resetToken: string;
  expiresInSeconds: number;
}

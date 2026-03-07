export const AUTH_EVENTS = {
  USER_REGISTERED: 'auth.user.registered',
  FORGOT_PASSWORD: 'auth.password.forgot',
  PASSWORD_RESET: 'auth.password.reset',
  EMAIL_VERIFIED: 'auth.email.verified',
} as const;

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

export interface PasswordResetEvent {
  userId: string;
  email: string;
}

export interface EmailVerifiedEvent {
  userId: string;
}

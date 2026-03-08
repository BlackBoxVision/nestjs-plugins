export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  OWNER: 'owner',
  MEMBER: 'member',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const VERIFICATION_TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
} as const;

export type VerificationTokenType =
  (typeof VERIFICATION_TOKEN_TYPES)[keyof typeof VERIFICATION_TOKEN_TYPES];

export const AUTH_PROVIDERS = {
  CREDENTIALS: 'credentials',
  GOOGLE: 'google',
} as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];

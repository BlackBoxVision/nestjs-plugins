export interface JwtConfig {
  secret: string;
  expiresIn?: string;
}

export interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scope?: string[];
}

export interface AppleProviderConfig {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  callbackUrl: string;
}

export interface MicrosoftProviderConfig {
  clientId: string;
  clientSecret: string;
  tenantId?: string;
  callbackUrl: string;
}

export interface AuthFeatures {
  emailPassword?: boolean;
  google?: boolean;
  apple?: boolean;
  microsoft?: boolean;
  magicLink?: boolean;
  organizations?: boolean;
  emailVerification?: boolean;
  passwordReset?: boolean;
  twoFactor?: boolean | TwoFactorConfig;
  sessionManagement?: boolean;
  accountLinking?: boolean;
}

export interface TwoFactorConfig {
  enabled: boolean;
  methods?: string[];
  enforced?: boolean;
  gracePeriodDays?: number;
}

export interface TwoFactorJwtConfig {
  challengeTokenSecret?: string;
  challengeTokenExpiresIn?: string;
}

export interface PermissionMapping {
  [role: string]: string[];
}

export interface PermissionsConfig {
  rolePermissions: PermissionMapping;
  superAdminRoles?: string[];
}

export interface AuthModuleOptions {
  jwt: JwtConfig;
  features?: AuthFeatures;
  providers?: {
    google?: GoogleProviderConfig;
    apple?: AppleProviderConfig;
    microsoft?: MicrosoftProviderConfig;
  };
  passwordHashRounds?: number;
  verificationTokenExpiresIn?: number;
  twoFactorJwt?: TwoFactorJwtConfig;
  permissions?: PermissionsConfig;
  defaultAdminEmail?: string;
}

export interface AuthModuleAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<AuthModuleOptions> | AuthModuleOptions;
  inject?: any[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  emailVerified?: boolean;
  isActive?: boolean;
  iat?: number;
  exp?: number;
}

export interface TwoFactorChallengePayload {
  sub: string;
  email: string;
  twoFactorRequired: true;
}

export interface LoginResult {
  user: AuthenticatedUser;
  accessToken: string;
}

export interface TwoFactorChallengeResult {
  challengeToken: string;
  twoFactorRequired: true;
  methods: string[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
  emailVerified: boolean;
  isActive: boolean;
}

export const AUTH_MODULE_OPTIONS = 'AUTH_MODULE_OPTIONS';
export const OTP_SERVICE = 'OTP_SERVICE';

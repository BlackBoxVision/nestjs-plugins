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
  twoFactor?: boolean;
  sessionManagement?: boolean;
  accountLinking?: boolean;
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
}

export interface AuthModuleAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<AuthModuleOptions> | AuthModuleOptions;
  inject?: any[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  isActive: boolean;
}

export const AUTH_MODULE_OPTIONS = 'AUTH_MODULE_OPTIONS';

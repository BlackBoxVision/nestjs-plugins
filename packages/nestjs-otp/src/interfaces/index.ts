export const OTP_MODULE_OPTIONS = 'OTP_MODULE_OPTIONS';
export const OTP_SERVICE = 'OTP_SERVICE';

export interface TotpMethodConfig {
  enabled: true;
  method: 'totp';
  issuer: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
  backupCodesCount?: number;
}

export interface SmsMethodConfig {
  enabled: true;
  method: 'sms';
  codeLength?: number;
  expiresInSeconds?: number;
}

export interface EmailMethodConfig {
  enabled: true;
  method: 'email';
  codeLength?: number;
  expiresInSeconds?: number;
}

export interface OtpFeatures {
  totp?: boolean;
  smsOtp?: boolean;
  emailOtp?: boolean;
  rateLimiting?: boolean;
  backupCodes?: boolean;
}

export interface RateLimitConfig {
  maxAttempts?: number;
  windowSeconds?: number;
  lockoutSeconds?: number;
}

export interface OtpModuleOptions {
  encryptionKey: string;
  methods: {
    totp?: TotpMethodConfig | { enabled: false };
    sms?: SmsMethodConfig | { enabled: false };
    email?: EmailMethodConfig | { enabled: false };
  };
  features?: OtpFeatures;
  rateLimiting?: RateLimitConfig;
}

export interface OtpModuleAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<OtpModuleOptions> | OtpModuleOptions;
  inject?: any[];
}

export interface OtpGenerateResult {
  code: string;
  expiresAt?: Date;
}

export interface OtpProvider {
  generate(userId: string, context?: string): Promise<OtpGenerateResult>;
  verify(userId: string, code: string, context?: string): Promise<boolean>;
}

export interface TotpSetupResult {
  secret: string;
  otpAuthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface OtpVerifyResult {
  success: boolean;
  method: string;
}

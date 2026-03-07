export const OTP_EVENTS = {
  CODE_GENERATED: 'otp.code.generated',
  TOTP_SETUP: 'otp.totp.setup',
  TOTP_CONFIRMED: 'otp.totp.confirmed',
  VERIFIED: 'otp.verified',
  FAILED: 'otp.failed',
  DISABLED: 'otp.disabled',
  BACKUP_CODES_REGENERATED: 'otp.backup-codes.regenerated',
} as const;

export interface OtpCodeGeneratedEvent {
  userId: string;
  method: 'sms' | 'email';
  code: string;
  context?: string;
  expiresAt: Date;
}

export interface OtpTotpSetupEvent {
  userId: string;
  otpAuthUrl: string;
  qrCodeDataUrl: string;
  secret: string;
}

export interface OtpTotpConfirmedEvent {
  userId: string;
}

export interface OtpVerifiedEvent {
  userId: string;
  method: string;
  context?: string;
}

export interface OtpFailedEvent {
  userId: string;
  method: string;
  reason: string;
  context?: string;
}

export interface OtpDisabledEvent {
  userId: string;
  method: string;
}

export interface OtpBackupCodesRegeneratedEvent {
  userId: string;
}

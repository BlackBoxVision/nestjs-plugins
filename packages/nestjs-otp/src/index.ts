// Module
export { OtpModule } from './otp.module';

// Services
export { OtpService } from './otp.service';

// Providers
export { TotpProvider } from './providers/totp.provider';
export { SmsOtpProvider } from './providers/sms-otp.provider';
export { EmailOtpProvider } from './providers/email-otp.provider';

// Guards
export { OtpVerifiedGuard } from './guards/otp-verified.guard';
export { OtpRateLimitGuard } from './guards/otp-rate-limit.guard';

// Decorators
export { RequireOtp, REQUIRE_OTP_KEY } from './decorators/require-otp.decorator';

// DTOs
export {
  SetupTotpDto,
  ConfirmTotpDto,
  SendOtpDto,
  VerifyOtpDto,
  DisableOtpDto,
  RegenerateBackupCodesDto,
} from './dto';

// Events
export { OTP_EVENTS } from './events';
export type {
  OtpCodeGeneratedEvent,
  OtpTotpSetupEvent,
  OtpTotpConfirmedEvent,
  OtpVerifiedEvent,
  OtpFailedEvent,
  OtpDisabledEvent,
  OtpBackupCodesRegeneratedEvent,
} from './events';

// Interfaces & Constants
export { OTP_MODULE_OPTIONS, OTP_SERVICE } from './interfaces';
export type {
  OtpModuleOptions,
  OtpModuleAsyncOptions,
  OtpFeatures,
  RateLimitConfig,
  TotpMethodConfig,
  SmsMethodConfig,
  EmailMethodConfig,
  OtpProvider,
  OtpGenerateResult,
  TotpSetupResult,
  OtpVerifyResult,
} from './interfaces';

// Module
export { AuthModule } from './auth.module';

// Services
export { AuthService } from './auth.service';
export { OrganizationService } from './organizations/organization.service';

// Guards
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RolesGuard } from './guards/roles.guard';

// Decorators
export { CurrentUser } from './decorators/current-user.decorator';
export { Roles, ROLES_KEY } from './decorators/roles.decorator';
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator';

// Strategies
export { JwtStrategy } from './strategies/jwt.strategy';
export { GoogleStrategy } from './strategies/google.strategy';
export { LocalStrategy } from './strategies/local.strategy';

// DTOs
export {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
  TwoFactorVerifyDto,
} from './dto';

// Events
export { AUTH_EVENTS } from './events';
export type {
  UserRegisteredEvent,
  ForgotPasswordEvent,
  PasswordResetEvent,
  EmailVerifiedEvent,
} from './events';

// Interfaces & Constants
export { AUTH_MODULE_OPTIONS, OTP_SERVICE } from './interfaces';
export type {
  AuthModuleOptions,
  AuthModuleAsyncOptions,
  AuthFeatures,
  JwtConfig,
  GoogleProviderConfig,
  AppleProviderConfig,
  MicrosoftProviderConfig,
  JwtPayload,
  AuthenticatedUser,
  TwoFactorConfig,
  TwoFactorJwtConfig,
  TwoFactorChallengePayload,
  LoginResult,
  TwoFactorChallengeResult,
} from './interfaces';

// Module
export { AuthModule } from './auth.module';

// Services
export { AuthService } from './auth.service';
export { OrganizationService } from './organizations/organization.service';

// Guards
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RolesGuard } from './guards/roles.guard';
export { PermissionsGuard } from './guards/permissions.guard';
export { OrgMemberGuard } from './guards/org-member.guard';

// Decorators
export { CurrentUser } from './decorators/current-user.decorator';
export { Roles, ROLES_KEY } from './decorators/roles.decorator';
export { Permissions, PERMISSIONS_KEY } from './decorators/permissions.decorator';
export { OrgRoles, ORG_ROLES_KEY } from './decorators/org-roles.decorator';
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

export {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddMemberDto,
} from './organizations/dto';

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
  PermissionMapping,
  PermissionsConfig,
} from './interfaces';

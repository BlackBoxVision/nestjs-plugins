import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class SetupTotpDto {
  // No body needed — userId comes from JWT
}

export class ConfirmTotpDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class SendOtpDto {
  @IsString()
  @IsIn(['sms', 'email'])
  method!: 'sms' | 'email';

  @IsString()
  @IsOptional()
  context?: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  @IsIn(['totp', 'sms', 'email', 'backup'])
  method?: 'totp' | 'sms' | 'email' | 'backup';

  @IsString()
  @IsOptional()
  context?: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class DisableOtpDto {
  @IsString()
  @IsIn(['totp', 'sms', 'email'])
  method!: 'totp' | 'sms' | 'email';

  @IsString()
  @IsNotEmpty()
  verificationCode!: string;
}

export class RegenerateBackupCodesDto {
  @IsString()
  @IsNotEmpty()
  verificationCode!: string;
}

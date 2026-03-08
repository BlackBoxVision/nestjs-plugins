import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'User password', example: 'P@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password!: string;
}

export class LoginDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'User password', example: 'P@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address to send password reset link', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token received via email' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password to set', example: 'N3wP@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current account password', example: 'OldP@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ description: 'New password to set', example: 'N3wP@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword!: string;
}

export class TwoFactorVerifyDto {
  @ApiProperty({ description: 'Challenge token from the 2FA initiation response' })
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @ApiProperty({ description: '2FA verification code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ description: '2FA method (e.g., totp, sms)', example: 'totp' })
  @IsString()
  @IsOptional()
  method?: string;
}

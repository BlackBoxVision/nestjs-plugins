import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';

import { OtpService } from './otp.service';
import {
  ConfirmTotpDto,
  DisableOtpDto,
  RegenerateBackupCodesDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * OTP controller for managing TOTP setup, OTP send/verify, and backup codes.
 *
 * **Important**: This controller requires a global authentication guard (e.g., JwtAuthGuard)
 * to be applied by the consuming application. All endpoints extract the authenticated user's
 * ID from `req.user.id` via the `@CurrentUser()` decorator. Without an auth guard, the
 * userId will be `undefined` and operations will fail.
 */
@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('totp/setup')
  async setupTotp(@CurrentUser() userId: string) {
    return this.otpService.setupTotp(userId);
  }

  @Post('totp/confirm')
  async confirmTotp(
    @CurrentUser() userId: string,
    @Body() body: ConfirmTotpDto,
  ) {
    return this.otpService.confirmTotpSetup(userId, body.code);
  }

  @Post('send')
  async sendOtp(
    @CurrentUser() userId: string,
    @Body() body: SendOtpDto,
  ) {
    return this.otpService.sendOtp(userId, body.method, {
      context: body.context,
    });
  }

  @Post('verify')
  async verifyOtp(
    @CurrentUser() userId: string,
    @Body() body: VerifyOtpDto,
  ) {
    return this.otpService.verifyOtp(userId, body.code, {
      method: body.method,
      context: body.context,
    });
  }

  @Post('disable')
  async disableOtp(
    @CurrentUser() userId: string,
    @Body() body: DisableOtpDto,
  ) {
    await this.otpService.disableMethod(
      userId,
      body.method,
      body.verificationCode,
    );
    return { success: true };
  }

  @Get('methods')
  async getMethods(@CurrentUser() userId: string) {
    const methods = await this.otpService.getEnabledMethods(userId);
    return { methods };
  }

  @Post('backup-codes/regenerate')
  async regenerateBackupCodes(
    @CurrentUser() userId: string,
    @Body() body: RegenerateBackupCodesDto,
  ) {
    const codes = await this.otpService.regenerateBackupCodes(
      userId,
      body.verificationCode,
    );
    return { backupCodes: codes };
  }
}

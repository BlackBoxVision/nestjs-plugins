import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import { OtpService } from './otp.service';
import {
  ConfirmTotpDto,
  DisableOtpDto,
  RegenerateBackupCodesDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('totp/setup')
  async setupTotp(@Body() body: { userId: string }) {
    return this.otpService.setupTotp(body.userId);
  }

  @Post('totp/confirm')
  async confirmTotp(@Body() body: ConfirmTotpDto & { userId: string }) {
    return this.otpService.confirmTotpSetup(body.userId, body.code);
  }

  @Post('send')
  async sendOtp(@Body() body: SendOtpDto & { userId: string }) {
    return this.otpService.sendOtp(body.userId, body.method, {
      context: body.context,
    });
  }

  @Post('verify')
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.otpService.verifyOtp(body.userId, body.code, {
      method: body.method,
      context: body.context,
    });
  }

  @Post('disable')
  async disableOtp(@Body() body: DisableOtpDto & { userId: string }) {
    await this.otpService.disableMethod(
      body.userId,
      body.method,
      body.verificationCode,
    );
    return { success: true };
  }

  @Get('methods')
  async getMethods(@Body() body: { userId: string }) {
    const methods = await this.otpService.getEnabledMethods(body.userId);
    return { methods };
  }

  @Post('backup-codes/regenerate')
  async regenerateBackupCodes(
    @Body() body: RegenerateBackupCodesDto & { userId: string },
  ) {
    const codes = await this.otpService.regenerateBackupCodes(
      body.userId,
      body.verificationCode,
    );
    return { backupCodes: codes };
  }
}

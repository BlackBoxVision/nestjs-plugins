import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { OtpService } from '../otp.service';
import { REQUIRE_OTP_KEY } from '../decorators/require-otp.decorator';

@Injectable()
export class OtpVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly otpService: OtpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireOtp = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_OTP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireOtp) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const isOtpEnabled = await this.otpService.isOtpEnabled(user.id);
    if (!isOtpEnabled) return true;

    const otpVerified = request.otpVerified === true;
    if (!otpVerified) {
      throw new ForbiddenException('OTP verification required');
    }

    return true;
  }
}

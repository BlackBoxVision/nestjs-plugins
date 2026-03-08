import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { OtpService } from '../otp.service';

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  constructor(
    private readonly otpService: OtpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.body?.userId;

    if (!userId) return true;

    // Delegates to OtpService.checkRateLimit which reads the module options
    // and throws ForbiddenException when the rate limit is exceeded.
    await this.otpService.checkRateLimit(userId, 'any');

    return true;
  }
}

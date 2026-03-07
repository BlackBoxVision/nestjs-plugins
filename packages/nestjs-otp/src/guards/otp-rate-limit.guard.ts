import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';

import {
  OTP_MODULE_OPTIONS,
  OtpModuleOptions,
} from '../interfaces';

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  constructor(
    @Inject('PRISMA_SERVICE')
    private readonly prisma: any,
    @Inject(OTP_MODULE_OPTIONS)
    private readonly options: OtpModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.options.features?.rateLimiting === false) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.body?.userId;

    if (!userId) return true;

    const config = this.options.rateLimiting;
    const maxAttempts = config?.maxAttempts ?? 5;
    const windowSeconds = config?.windowSeconds ?? 300;
    const lockoutSeconds = config?.lockoutSeconds ?? 900;

    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    const recentFailures = await this.prisma.otpAttempt.count({
      where: {
        userId,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    if (recentFailures >= maxAttempts) {
      const lastAttempt = await this.prisma.otpAttempt.findFirst({
        where: { userId, success: false },
        orderBy: { createdAt: 'desc' },
      });

      if (lastAttempt) {
        const lockoutEnd = new Date(
          lastAttempt.createdAt.getTime() + lockoutSeconds * 1000,
        );
        if (new Date() < lockoutEnd) {
          throw new ForbiddenException(
            'Too many OTP attempts. Please try again later.',
          );
        }
      }
    }

    return true;
  }
}

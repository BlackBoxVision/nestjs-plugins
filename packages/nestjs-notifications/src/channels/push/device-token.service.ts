import { Inject, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeviceTokenService {
  private readonly logger = new Logger(DeviceTokenService.name);

  constructor(
    @Inject('PRISMA_SERVICE')
    private readonly prisma: any,
  ) {}

  async register(userId: string, token: string, platform: string) {
    this.logger.log(
      `Registering device token for user ${userId} (${platform})`,
    );

    return this.prisma.deviceToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform, updatedAt: new Date() },
    });
  }

  async unregister(userId: string, token: string) {
    this.logger.log(`Unregistering device token for user ${userId}`);

    return this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });
  }

  async unregisterAll(userId: string) {
    this.logger.log(`Unregistering all device tokens for user ${userId}`);

    return this.prisma.deviceToken.deleteMany({
      where: { userId },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

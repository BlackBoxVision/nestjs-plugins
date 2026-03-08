import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';

@Injectable()
export class PreferenceService {
  private readonly logger = new Logger(PreferenceService.name);

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prisma: any,
  ) {}

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
    });
  }

  async upsertPreference(
    userId: string,
    channel: string,
    type: string,
    enabled: boolean,
  ) {
    this.logger.log(
      `Upserting preference for user ${userId}: ${channel}/${type} = ${enabled}`,
    );

    return this.prisma.notificationPreference.upsert({
      where: {
        userId_channel_type: { userId, channel, type },
      },
      update: { enabled },
      create: { userId, channel, type, enabled },
    });
  }

  async isEnabled(
    userId: string,
    channel: string,
    type: string,
  ): Promise<boolean> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_channel_type: { userId, channel, type },
      },
    });

    // Default to enabled if no preference record exists
    return preference?.enabled ?? true;
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import { NOTIFICATION_STATUSES, NOTIFICATION_CHANNELS } from '../../constants';
import type { SendNotificationPayload } from '../../interfaces';

export interface FindAllOptions {
  skip?: number;
  take?: number;
  status?: string;
}

@Injectable()
export class InAppService {
  private readonly logger = new Logger(InAppService.name);

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prisma: any,
  ) {}

  async create(payload: SendNotificationPayload, notificationId?: string) {
    this.logger.log(
      `Creating in-app notification for user ${payload.userId}`,
    );

    // If a notification record already exists (created by NotificationService.send),
    // update it instead of creating a duplicate.
    if (notificationId) {
      return this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NOTIFICATION_STATUSES.DELIVERED,
          sentAt: new Date(),
        },
      });
    }

    return this.prisma.notification.create({
      data: {
        userId: payload.userId,
        channel: NOTIFICATION_CHANNELS.IN_APP,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? undefined,
        status: NOTIFICATION_STATUSES.DELIVERED,
        sentAt: new Date(),
      },
    });
  }

  async findAllForUser(userId: string, options: FindAllOptions = {}) {
    const { skip = 0, take = 20, status } = options;

    const where: Record<string, unknown> = {
      userId,
      channel: NOTIFICATION_CHANNELS.IN_APP,
    };

    if (status) {
      where['status'] = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, channel: 'in_app' },
      data: { readAt: new Date(), status: 'read' },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        channel: NOTIFICATION_CHANNELS.IN_APP,
        readAt: null,
      },
      data: { readAt: new Date(), status: 'read' },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        channel: NOTIFICATION_CHANNELS.IN_APP,
        readAt: null,
      },
    });
  }
}

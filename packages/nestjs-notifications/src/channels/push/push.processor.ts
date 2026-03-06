import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { PushProvider, PushSendOptions } from '../../interfaces';
import { PUSH_PROVIDER } from '../../interfaces';

export interface PushJobData {
  notificationId: string;
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  android?: Record<string, unknown>;
  apns?: Record<string, unknown>;
  webpush?: Record<string, unknown>;
}

@Processor('notifications-push')
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(
    @Inject(PUSH_PROVIDER)
    private readonly pushProvider: PushProvider,
    @Inject('PRISMA_SERVICE')
    private readonly prisma: any,
  ) {
    super();
  }

  async process(job: Job<PushJobData>): Promise<void> {
    const { notificationId, token, title, body, data, android, apns, webpush } =
      job.data;

    this.logger.log(
      `Processing push job ${job.id} for notification ${notificationId}`,
    );

    try {
      const sendOptions: PushSendOptions = {
        token,
        title,
        body,
        data,
        android,
        apns,
        webpush,
      };

      await this.pushProvider.send(sendOptions);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      this.logger.log(
        `Push sent successfully for notification ${notificationId}`,
      );
    } catch (error) {
      const failReason =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to send push for notification ${notificationId}: ${failReason}`,
      );

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'failed',
          failReason,
        },
      });

      throw error;
    }
  }
}

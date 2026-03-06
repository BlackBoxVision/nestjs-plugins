import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { SmsProvider, SmsSendOptions } from '../../interfaces';
import { SMS_PROVIDER } from '../../interfaces';

export interface SmsJobData {
  notificationId: string;
  to: string;
  body: string;
  from?: string;
}

@Processor('notifications-sms')
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
    @Inject('PRISMA_SERVICE')
    private readonly prisma: any,
  ) {
    super();
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    const { notificationId, to, body, from } = job.data;

    this.logger.log(
      `Processing SMS job ${job.id} for notification ${notificationId}`,
    );

    try {
      const sendOptions: SmsSendOptions = { to, body, from };

      await this.smsProvider.send(sendOptions);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      this.logger.log(
        `SMS sent successfully for notification ${notificationId}`,
      );
    } catch (error) {
      const failReason =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to send SMS for notification ${notificationId}: ${failReason}`,
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

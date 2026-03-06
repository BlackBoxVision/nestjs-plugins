import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { EmailProvider, EmailSendOptions } from '../../interfaces';
import { EMAIL_PROVIDER } from '../../interfaces';

export interface EmailJobData {
  notificationId: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

@Processor('notifications-email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    @Inject('PRISMA_SERVICE')
    private readonly prisma: any,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { notificationId, to, subject, html, text, from, replyTo } =
      job.data;

    this.logger.log(
      `Processing email job ${job.id} for notification ${notificationId}`,
    );

    try {
      const sendOptions: EmailSendOptions = {
        to,
        subject,
        html,
        text,
        from,
        replyTo,
      };

      await this.emailProvider.send(sendOptions);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      this.logger.log(
        `Email sent successfully for notification ${notificationId}`,
      );
    } catch (error) {
      const failReason =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to send email for notification ${notificationId}: ${failReason}`,
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

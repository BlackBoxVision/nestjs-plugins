import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import type { Job } from 'bullmq';
import type { EmailProvider, EmailSendOptions } from '../../interfaces';
import { EMAIL_PROVIDER } from '../../interfaces';
import { BaseNotificationProcessor } from '../base.processor';

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
  protected readonly logger = new Logger(EmailProcessor.name);
  protected readonly prisma: any;

  private readonly base: BaseNotificationProcessorDelegate;

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    @Inject(PRISMA_SERVICE)
    prisma: any,
  ) {
    super();
    this.prisma = prisma;
    this.base = new BaseNotificationProcessorDelegate(this.logger, this.prisma);
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, text, from, replyTo } = job.data;

    await this.base.processWithStatusTracking(job, 'email', async () => {
      const sendOptions: EmailSendOptions = {
        to,
        subject,
        html,
        text,
        from,
        replyTo,
      };

      await this.emailProvider.send(sendOptions);
    });
  }
}

/**
 * Internal delegate to reuse BaseNotificationProcessor logic inside a
 * WorkerHost subclass (which already extends WorkerHost and cannot also
 * extend BaseNotificationProcessor).
 */
class BaseNotificationProcessorDelegate extends BaseNotificationProcessor {
  protected readonly logger: Logger;
  protected readonly prisma: any;

  constructor(logger: Logger, prisma: any) {
    super();
    this.logger = logger;
    this.prisma = prisma;
  }
}

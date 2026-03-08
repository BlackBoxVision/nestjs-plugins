import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import type { Job } from 'bullmq';
import type { SmsProvider, SmsSendOptions } from '../../interfaces';
import { SMS_PROVIDER } from '../../interfaces';
import { BaseNotificationProcessor } from '../base.processor';

export interface SmsJobData {
  notificationId: string;
  to: string;
  body: string;
  from?: string;
}

@Processor('notifications-sms')
export class SmsProcessor extends WorkerHost {
  protected readonly logger = new Logger(SmsProcessor.name);
  protected readonly prisma: any;

  private readonly base: BaseNotificationProcessorDelegate;

  constructor(
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
    @Inject(PRISMA_SERVICE)
    prisma: any,
  ) {
    super();
    this.prisma = prisma;
    this.base = new BaseNotificationProcessorDelegate(this.logger, this.prisma);
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    const { to, body, from } = job.data;

    await this.base.processWithStatusTracking(job, 'SMS', async () => {
      const sendOptions: SmsSendOptions = { to, body, from };
      await this.smsProvider.send(sendOptions);
    });
  }
}

class BaseNotificationProcessorDelegate extends BaseNotificationProcessor {
  protected readonly logger: Logger;
  protected readonly prisma: any;

  constructor(logger: Logger, prisma: any) {
    super();
    this.logger = logger;
    this.prisma = prisma;
  }
}

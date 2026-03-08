import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import type { Job } from 'bullmq';
import type { PushProvider, PushSendOptions } from '../../interfaces';
import { PUSH_PROVIDER } from '../../interfaces';
import { BaseNotificationProcessor } from '../base.processor';

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
  protected readonly logger = new Logger(PushProcessor.name);
  protected readonly prisma: any;

  private readonly base: BaseNotificationProcessorDelegate;

  constructor(
    @Inject(PUSH_PROVIDER)
    private readonly pushProvider: PushProvider,
    @Inject(PRISMA_SERVICE)
    prisma: any,
  ) {
    super();
    this.prisma = prisma;
    this.base = new BaseNotificationProcessorDelegate(this.logger, this.prisma);
  }

  async process(job: Job<PushJobData>): Promise<void> {
    const { token, title, body, data, android, apns, webpush } = job.data;

    await this.base.processWithStatusTracking(job, 'push', async () => {
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

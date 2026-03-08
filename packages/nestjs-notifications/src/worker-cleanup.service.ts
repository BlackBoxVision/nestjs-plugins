import { Injectable, Optional, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Worker, Queue } from 'bullmq';
import { EMAIL_WORKER, SMS_WORKER, PUSH_WORKER } from './interfaces';

@Injectable()
export class WorkerCleanupService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerCleanupService.name);

  constructor(
    @Optional() @Inject(EMAIL_WORKER) private readonly emailWorker: Worker | null,
    @Optional() @Inject(SMS_WORKER) private readonly smsWorker: Worker | null,
    @Optional() @Inject(PUSH_WORKER) private readonly pushWorker: Worker | null,
    @Optional() @InjectQueue('notifications-email') private readonly emailQueue?: Queue,
    @Optional() @InjectQueue('notifications-sms') private readonly smsQueue?: Queue,
    @Optional() @InjectQueue('notifications-push') private readonly pushQueue?: Queue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    // Close workers first so no new jobs are picked up
    const workers = [
      { name: 'email', worker: this.emailWorker },
      { name: 'sms', worker: this.smsWorker },
      { name: 'push', worker: this.pushWorker },
    ];

    const workerResults = await Promise.allSettled(
      workers
        .filter(({ worker }) => worker != null)
        .map(async ({ name, worker }) => {
          this.logger.log(`Closing ${name} worker...`);
          await worker!.close();
          this.logger.log(`${name} worker closed`);
        }),
    );

    for (const result of workerResults) {
      if (result.status === 'rejected') {
        this.logger.error(`Failed to close worker: ${result.reason}`);
      }
    }

    // Close queue connections to release Redis connections
    const queues = [
      { name: 'email', queue: this.emailQueue },
      { name: 'sms', queue: this.smsQueue },
      { name: 'push', queue: this.pushQueue },
    ];

    const queueResults = await Promise.allSettled(
      queues
        .filter(({ queue }) => queue != null)
        .map(async ({ name, queue }) => {
          this.logger.log(`Closing ${name} queue...`);
          await queue!.close();
          this.logger.log(`${name} queue closed`);
        }),
    );

    for (const result of queueResults) {
      if (result.status === 'rejected') {
        this.logger.error(`Failed to close queue: ${result.reason}`);
      }
    }
  }
}

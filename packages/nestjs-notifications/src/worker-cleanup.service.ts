import { Injectable, Optional, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import type { Worker } from 'bullmq';
import { EMAIL_WORKER, SMS_WORKER, PUSH_WORKER } from './interfaces';

@Injectable()
export class WorkerCleanupService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerCleanupService.name);

  constructor(
    @Optional() @Inject(EMAIL_WORKER) private readonly emailWorker: Worker | null,
    @Optional() @Inject(SMS_WORKER) private readonly smsWorker: Worker | null,
    @Optional() @Inject(PUSH_WORKER) private readonly pushWorker: Worker | null,
  ) {}

  async onModuleDestroy(): Promise<void> {
    const workers = [
      { name: 'email', worker: this.emailWorker },
      { name: 'sms', worker: this.smsWorker },
      { name: 'push', worker: this.pushWorker },
    ];

    const results = await Promise.allSettled(
      workers
        .filter(({ worker }) => worker != null)
        .map(async ({ name, worker }) => {
          this.logger.log(`Closing ${name} worker...`);
          await worker!.close();
          this.logger.log(`${name} worker closed`);
        }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Failed to close worker: ${result.reason}`);
      }
    }
  }
}

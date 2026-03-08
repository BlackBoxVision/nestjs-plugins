import { Logger } from '@nestjs/common';
import { NOTIFICATION_STATUSES } from '../constants';
import type { Job } from 'bullmq';

/**
 * Abstract base class for notification channel processors.
 *
 * Provides a reusable `processWithStatusTracking()` method that wraps the
 * channel-specific send logic with consistent status updates:
 * - On success: marks the notification as "sent" with a timestamp.
 * - On failure: marks as "failed" only on the final retry attempt.
 * - Always re-throws the error so BullMQ can handle retries.
 */
export abstract class BaseNotificationProcessor {
  protected abstract readonly logger: Logger;
  protected abstract readonly prisma: any;

  async processWithStatusTracking(
    job: Job<{ notificationId: string }>,
    channelName: string,
    sendFn: () => Promise<void>,
  ): Promise<void> {
    const { notificationId } = job.data;

    this.logger.log(
      `Processing ${channelName} job ${job.id} for notification ${notificationId}`,
    );

    try {
      await sendFn();

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NOTIFICATION_STATUSES.SENT,
          sentAt: new Date(),
        },
      });

      this.logger.log(
        `${channelName} sent successfully for notification ${notificationId}`,
      );
    } catch (error) {
      const failReason =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to send ${channelName} for notification ${notificationId}: ${failReason}`,
      );

      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= maxAttempts - 1) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NOTIFICATION_STATUSES.FAILED,
            failReason,
          },
        });
      }

      throw error;
    }
  }
}

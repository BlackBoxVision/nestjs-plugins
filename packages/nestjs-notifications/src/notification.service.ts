import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  NOTIFICATION_MODULE_OPTIONS,
  type NotificationModuleOptions,
  type SendNotificationPayload,
} from './interfaces';
import { InAppService } from './channels/in-app/in-app.service';
import { PreferenceService } from './preferences/preference.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions,
    @Inject('PRISMA_SERVICE')
    private readonly prisma: any,
    @Optional()
    @InjectQueue('notifications-email')
    private readonly emailQueue?: Queue,
    @Optional()
    @InjectQueue('notifications-sms')
    private readonly smsQueue?: Queue,
    @Optional()
    private readonly inAppService?: InAppService,
    @Optional()
    private readonly preferenceService?: PreferenceService,
  ) {}

  async send(payload: SendNotificationPayload): Promise<{ id: string }> {
    const { userId, channel, type, title, body, data, to } = payload;

    // Check user preferences if the feature is enabled
    if (this.preferenceService && this.options.features?.preferences !== false) {
      const enabled = await this.preferenceService.isEnabled(
        userId,
        channel,
        type,
      );

      if (!enabled) {
        this.logger.log(
          `Notification suppressed by user preference: ${userId}/${channel}/${type}`,
        );
        return { id: '' };
      }
    }

    // Persist notification record
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        channel,
        type,
        title,
        body,
        data: data ?? undefined,
        status: 'pending',
      },
    });

    this.logger.log(
      `Created notification ${notification.id} (${channel}/${type}) for user ${userId}`,
    );

    // Route to the correct channel
    switch (channel) {
      case 'email':
        await this.routeEmail(notification.id, payload);
        break;
      case 'in_app':
        await this.routeInApp(payload);
        break;
      case 'sms':
        await this.routeSms(notification.id, payload);
        break;
      default:
        this.logger.warn(`Unknown notification channel: ${channel}`);
    }

    return { id: notification.id };
  }

  private async routeEmail(
    notificationId: string,
    payload: SendNotificationPayload,
  ): Promise<void> {
    const emailConfig = this.options.channels.email;

    if (!emailConfig || !emailConfig.enabled) {
      this.logger.warn('Email channel is not enabled, skipping');
      return;
    }

    if (!this.emailQueue) {
      this.logger.error('Email queue is not available');
      return;
    }

    if (!payload.to) {
      this.logger.error(
        `No recipient address provided for email notification ${notificationId}`,
      );
      return;
    }

    await this.emailQueue.add('send', {
      notificationId,
      to: payload.to,
      subject: payload.title,
      html: payload.body,
    });

    this.logger.log(`Email notification ${notificationId} queued`);
  }

  private async routeInApp(
    payload: SendNotificationPayload,
  ): Promise<void> {
    const inAppConfig = this.options.channels.inApp;

    if (!inAppConfig?.enabled) {
      this.logger.warn('In-app channel is not enabled, skipping');
      return;
    }

    if (!this.inAppService) {
      this.logger.error('InAppService is not available');
      return;
    }

    await this.inAppService.create(payload);
  }

  private async routeSms(
    notificationId: string,
    payload: SendNotificationPayload,
  ): Promise<void> {
    const smsConfig = this.options.channels.sms;

    if (!smsConfig || !smsConfig.enabled) {
      this.logger.warn('SMS channel is not enabled, skipping');
      return;
    }

    if (!this.smsQueue) {
      this.logger.error('SMS queue is not available');
      return;
    }

    if (!payload.to) {
      this.logger.error(
        `No recipient phone provided for SMS notification ${notificationId}`,
      );
      return;
    }

    await this.smsQueue.add('send', {
      notificationId,
      to: payload.to,
      body: payload.body,
    });

    this.logger.log(`SMS notification ${notificationId} queued`);
  }
}

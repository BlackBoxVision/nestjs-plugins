import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  NOTIFICATION_MODULE_OPTIONS,
  type NotificationModuleOptions,
  type SendNotificationPayload,
} from './interfaces';
import { InAppService } from './channels/in-app/in-app.service';
import { DeviceTokenService } from './channels/push/device-token.service';
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
    @InjectQueue('notifications-push')
    private readonly pushQueue?: Queue,
    @Optional()
    private readonly inAppService?: InAppService,
    @Optional()
    private readonly deviceTokenService?: DeviceTokenService,
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
      case 'push':
        await this.routePush(notification.id, payload);
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
      await this.markAsFailed(notificationId, 'Email queue is not available');
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
      await this.markAsFailed(notificationId, 'SMS queue is not available');
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

  private async routePush(
    notificationId: string,
    payload: SendNotificationPayload,
  ): Promise<void> {
    const pushConfig = this.options.channels.push;

    if (!pushConfig || !pushConfig.enabled) {
      this.logger.warn('Push channel is not enabled, skipping');
      return;
    }

    if (!this.pushQueue) {
      this.logger.error('Push queue is not available');
      await this.markAsFailed(notificationId, 'Push queue is not available');
      return;
    }

    // If explicit `to` is provided, send to that single token
    if (payload.to) {
      await this.pushQueue.add('send', {
        notificationId,
        token: payload.to,
        title: payload.title,
        body: payload.body,
        data: payload.data as Record<string, string> | undefined,
      });

      this.logger.log(
        `Push notification ${notificationId} queued for token ${payload.to}`,
      );
      return;
    }

    // Fan-out to all registered devices for the user
    if (!this.deviceTokenService) {
      this.logger.error('DeviceTokenService is not available');
      return;
    }

    const devices = await this.deviceTokenService.findAllForUser(payload.userId);

    if (devices.length === 0) {
      this.logger.warn(
        `No registered devices for user ${payload.userId}, skipping push`,
      );
      return;
    }

    await Promise.all(
      devices.map((device: { token: string }) =>
        this.pushQueue!.add('send', {
          notificationId,
          token: device.token,
          title: payload.title,
          body: payload.body,
          data: payload.data as Record<string, string> | undefined,
        }),
      ),
    );

    this.logger.log(
      `Push notification ${notificationId} queued for ${devices.length} device(s)`,
    );
  }

  private async markAsFailed(
    notificationId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'failed', data: { failureReason: reason } },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update notification ${notificationId} status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

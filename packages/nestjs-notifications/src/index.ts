// Module
export { NotificationModule } from './notification.module';

// Main service
export { NotificationService } from './notification.service';

// Channel services
export { InAppService } from './channels/in-app/in-app.service';
export type { FindAllOptions } from './channels/in-app/in-app.service';
export { InAppController } from './channels/in-app/in-app.controller';

// Base processor
export { BaseNotificationProcessor } from './channels/base.processor';

// Email providers
export { SmtpEmailProvider } from './channels/email/providers/smtp.provider';
export { SendGridEmailProvider } from './channels/email/providers/sendgrid.provider';
export { EmailProcessor } from './channels/email/email.processor';
export type { EmailJobData } from './channels/email/email.processor';

// SMS providers
export { TwilioSmsProvider } from './channels/sms/providers/twilio.provider';
export { LogSmsProvider } from './channels/sms/providers/log.provider';
export { SmsProcessor } from './channels/sms/sms.processor';
export type { SmsJobData } from './channels/sms/sms.processor';

// Push providers
export { FirebasePushProvider } from './channels/push/providers/firebase.provider';
export { LogPushProvider } from './channels/push/providers/log.provider';
export { PushProcessor } from './channels/push/push.processor';
export type { PushJobData } from './channels/push/push.processor';
export { DeviceTokenService } from './channels/push/device-token.service';
export { DeviceTokenController } from './channels/push/device-token.controller';

// Preferences
export { PreferenceService } from './preferences/preference.service';
export { PreferenceController } from './preferences/preference.controller';

// Templates
export { TemplateService } from './templates/template.service';

// Worker cleanup
export { WorkerCleanupService } from './worker-cleanup.service';

// Guards
export {
  InAppFeatureGuard,
  PushFeatureGuard,
  PreferencesFeatureGuard,
} from './guards/feature-enabled.guard';

// DTOs
export { NotificationQueryDto } from './dto/notification-query.dto';
export { UpsertPreferenceDto } from './dto/upsert-preference.dto';
export { RegisterDeviceDto } from './dto/register-device.dto';

// Constants
export {
  NOTIFICATION_STATUSES,
  NOTIFICATION_CHANNELS,
} from './constants';
export type { NotificationStatus, NotificationChannel } from './constants';

// Interfaces and constants
export {
  NOTIFICATION_MODULE_OPTIONS,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  PUSH_PROVIDER,
  EMAIL_WORKER,
  SMS_WORKER,
  PUSH_WORKER,
} from './interfaces';

// Auth integration
export { AuthNotificationModule } from './integrations/auth';
export { AuthNotificationListener } from './integrations/auth';
export { AUTH_NOTIFICATION_CONFIG } from './integrations/auth';
export type { AuthNotificationConfig, AuthNotificationAsyncOptions } from './integrations/auth';

export type {
  EmailProvider,
  EmailSendOptions,
  EmailAttachment,
  SmsProvider,
  SmsSendOptions,
  PushProvider,
  PushSendOptions,
  SmtpProviderOptions,
  SendGridProviderOptions,
  SESProviderOptions,
  ResendProviderOptions,
  TwilioProviderOptions,
  FirebaseProviderOptions,
  EmailChannelConfig,
  SmsChannelConfig,
  PushChannelConfig,
  InAppChannelConfig,
  NotificationFeatures,
  NotificationModuleOptions,
  NotificationModuleAsyncOptions,
  SendNotificationPayload,
} from './interfaces';

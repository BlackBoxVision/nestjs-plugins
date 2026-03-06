// Module
export { NotificationModule } from './notification.module';

// Main service
export { NotificationService } from './notification.service';

// Channel services
export { InAppService } from './channels/in-app/in-app.service';
export type { FindAllOptions } from './channels/in-app/in-app.service';
export { InAppController } from './channels/in-app/in-app.controller';

// Email providers
export { SmtpEmailProvider } from './channels/email/providers/smtp.provider';
export { SendGridEmailProvider } from './channels/email/providers/sendgrid.provider';
export { EmailProcessor } from './channels/email/email.processor';
export type { EmailJobData } from './channels/email/email.processor';

// SMS providers
export { TwilioSmsProvider } from './channels/sms/providers/twilio.provider';
export { SmsProcessor } from './channels/sms/sms.processor';
export type { SmsJobData } from './channels/sms/sms.processor';

// Preferences
export { PreferenceService } from './preferences/preference.service';
export { PreferenceController } from './preferences/preference.controller';

// Templates
export { TemplateService } from './templates/template.service';

// Interfaces and constants
export {
  NOTIFICATION_MODULE_OPTIONS,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
} from './interfaces';

export type {
  EmailProvider,
  EmailSendOptions,
  EmailAttachment,
  SmsProvider,
  SmsSendOptions,
  SmtpProviderOptions,
  SendGridProviderOptions,
  SESProviderOptions,
  ResendProviderOptions,
  TwilioProviderOptions,
  EmailChannelConfig,
  SmsChannelConfig,
  InAppChannelConfig,
  NotificationFeatures,
  NotificationModuleOptions,
  NotificationModuleAsyncOptions,
  SendNotificationPayload,
} from './interfaces';

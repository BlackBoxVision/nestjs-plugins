export interface EmailProvider {
  send(options: EmailSendOptions): Promise<void>;
}

export interface EmailSendOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SmsProvider {
  send(options: SmsSendOptions): Promise<void>;
}

export interface SmsSendOptions {
  to: string;
  body: string;
  from?: string;
}

export interface SmtpProviderOptions {
  host: string;
  port: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  from: string;
}

export interface SendGridProviderOptions {
  apiKey: string;
  from: string;
}

export interface SESProviderOptions {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  from: string;
}

export interface ResendProviderOptions {
  apiKey: string;
  from: string;
}

export interface TwilioProviderOptions {
  accountSid: string;
  authToken: string;
  from: string;
}

export type EmailChannelConfig =
  | {
      enabled: true;
      provider: 'smtp';
      providerOptions: SmtpProviderOptions;
      templateDir?: string;
    }
  | {
      enabled: true;
      provider: 'sendgrid';
      providerOptions: SendGridProviderOptions;
      templateDir?: string;
    }
  | {
      enabled: true;
      provider: 'ses';
      providerOptions: SESProviderOptions;
      templateDir?: string;
    }
  | {
      enabled: true;
      provider: 'resend';
      providerOptions: ResendProviderOptions;
      templateDir?: string;
    }
  | { enabled: false };

export type SmsChannelConfig =
  | {
      enabled: true;
      provider: 'twilio';
      providerOptions: TwilioProviderOptions;
    }
  | {
      enabled: true;
      provider: 'log';
      providerOptions?: Record<string, never>;
    }
  | { enabled: false };

export interface PushProvider {
  send(options: PushSendOptions): Promise<void>;
}

export interface PushSendOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  android?: Record<string, unknown>;
  apns?: Record<string, unknown>;
  webpush?: Record<string, unknown>;
}

export interface FirebaseProviderOptions {
  serviceAccountKey: Record<string, unknown>;
}

export type PushChannelConfig =
  | {
      enabled: true;
      provider: 'firebase';
      providerOptions: FirebaseProviderOptions;
    }
  | {
      enabled: true;
      provider: 'log';
      providerOptions?: Record<string, never>;
    }
  | { enabled: false };

export interface InAppChannelConfig {
  enabled: boolean;
}

export interface NotificationFeatures {
  email?: boolean;
  inApp?: boolean;
  sms?: boolean;
  push?: boolean;
  preferences?: boolean;
  templates?: boolean;
}

export interface NotificationModuleOptions {
  channels: {
    email?: EmailChannelConfig;
    inApp?: InAppChannelConfig;
    sms?: SmsChannelConfig;
    push?: PushChannelConfig;
  };
  features?: NotificationFeatures;
  queue?: {
    redis: { host: string; port?: number; password?: string };
  };
  isGlobal?: boolean;
}

export interface NotificationModuleAsyncOptions {
  imports?: any[];
  isGlobal?: boolean;
  useFactory: (
    ...args: any[]
  ) => Promise<NotificationModuleOptions> | NotificationModuleOptions;
  inject?: any[];
}

export interface SendNotificationPayload {
  userId: string;
  channel: 'email' | 'in_app' | 'sms' | 'push';
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  to?: string;
}

export const NOTIFICATION_MODULE_OPTIONS = 'NOTIFICATION_MODULE_OPTIONS';
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
export const SMS_PROVIDER = 'SMS_PROVIDER';
export const PUSH_PROVIDER = 'PUSH_PROVIDER';
export const EMAIL_WORKER = 'EMAIL_WORKER';
export const SMS_WORKER = 'SMS_WORKER';
export const PUSH_WORKER = 'PUSH_WORKER';

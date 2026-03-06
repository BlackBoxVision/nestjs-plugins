# @bbv/nestjs-notifications

Multi-channel notification module for NestJS supporting email, in-app, and SMS with unified API, provider abstraction, templates, and per-user preferences.

## Installation

```bash
npm install @bbv/nestjs-notifications
```

**Peer dependencies:** `@nestjs/common`, `@nestjs/core`, `@nestjs/bullmq`, `@prisma/client`, `bullmq`

## Prisma Schema

```bash
cp node_modules/@bbv/nestjs-notifications/prisma/notifications.prisma prisma/schema/
npx prisma generate && npx prisma migrate dev
```

Provides: `Notification`, `NotificationPreference`

## Usage

```typescript
import { NotificationModule } from '@bbv/nestjs-notifications';

@Module({
  imports: [
    NotificationModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        channels: {
          email: {
            enabled: true,
            provider: 'smtp',
            providerOptions: {
              host: config.get('SMTP_HOST'),
              port: 587,
              from: 'noreply@app.com',
            },
            templateDir: path.join(__dirname, 'templates/email'),
          },
          inApp: { enabled: true },
          sms: {
            enabled: true,
            provider: 'twilio',
            providerOptions: {
              accountSid: config.get('TWILIO_SID'),
              authToken: config.get('TWILIO_TOKEN'),
              from: config.get('TWILIO_FROM'),
            },
          },
        },
        features: { preferences: true, templates: true },
        queue: { redis: { host: config.get('REDIS_HOST') } },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Sending Notifications

```typescript
import { NotificationService } from '@bbv/nestjs-notifications';

@Injectable()
export class ClaimsService {
  constructor(private readonly notifications: NotificationService) {}

  async approveClaim(claimId: string, userId: string) {
    await this.notifications.send({
      userId,
      channel: 'email',
      type: 'claim_approved',
      title: 'Claim Approved',
      body: 'Your warranty claim has been approved.',
      to: 'user@example.com',
    });

    await this.notifications.send({
      userId,
      channel: 'in_app',
      type: 'claim_approved',
      title: 'Claim Approved',
      body: 'Your warranty claim has been approved.',
    });
  }
}
```

## Feature Flags

| Flag | Default | What it controls |
|------|---------|-----------------|
| `email` | `true` | Email channel via configured provider |
| `inApp` | `false` | In-app notifications + REST endpoints |
| `sms` | `false` | SMS channel via configured provider |
| `preferences` | `false` | User notification preferences API |
| `templates` | `true` | Handlebars template rendering |

## Email Providers

| Provider | Config key | Options |
|----------|-----------|---------|
| SMTP | `smtp` | `host`, `port`, `secure`, `auth`, `from` |
| SendGrid | `sendgrid` | `apiKey`, `from` |
| AWS SES | `ses` | `region`, `accessKeyId`, `secretAccessKey`, `from` |
| Resend | `resend` | `apiKey`, `from` |

## SMS Providers

| Provider | Config key | Options |
|----------|-----------|---------|
| Twilio | `twilio` | `accountSid`, `authToken`, `from` |

## Templates

Built-in templates: `welcome`, `password-reset`, `verify-email`. Override by placing your own `.hbs` files in `templateDir`. Falls back to built-in defaults.

## In-App Endpoints

When `inApp` is enabled:
- `GET /notifications` — List user notifications
- `PATCH /notifications/:id/read` — Mark as read
- `PATCH /notifications/read-all` — Mark all as read
- `GET /notifications/unread-count` — Unread count

## License

[MIT](./LICENSE)

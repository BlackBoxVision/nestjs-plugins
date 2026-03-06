import { Logger } from '@nestjs/common';
import type {
  PushProvider,
  PushSendOptions,
  FirebaseProviderOptions,
} from '../../../interfaces';

let firebaseAdmin: any;

try {
  firebaseAdmin = require('firebase-admin');
} catch {
  // firebase-admin is an optional peer dependency
}

export class FirebasePushProvider implements PushProvider {
  private readonly logger = new Logger(FirebasePushProvider.name);
  private readonly app: any;

  constructor(options: FirebaseProviderOptions) {
    if (!firebaseAdmin) {
      throw new Error(
        'firebase-admin is required for FirebasePushProvider. Install it with: npm install firebase-admin',
      );
    }

    const appName = `notifications-${Date.now()}`;
    this.app = firebaseAdmin.initializeApp(
      {
        credential: firebaseAdmin.credential.cert(options.serviceAccountKey),
      },
      appName,
    );

    this.logger.log(`Firebase app initialized: ${appName}`);
  }

  async send(options: PushSendOptions): Promise<void> {
    const message: Record<string, unknown> = {
      token: options.token,
      notification: {
        title: options.title,
        body: options.body,
      },
    };

    if (options.data) {
      message.data = options.data;
    }

    if (options.android) {
      message.android = options.android;
    }

    if (options.apns) {
      message.apns = options.apns;
    }

    if (options.webpush) {
      message.webpush = options.webpush;
    }

    const messageId = await this.app.messaging().send(message);

    this.logger.log(`Push notification sent: ${messageId}`);
  }
}

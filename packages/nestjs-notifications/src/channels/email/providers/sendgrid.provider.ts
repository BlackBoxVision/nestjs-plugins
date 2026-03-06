import * as https from 'https';
import type {
  EmailProvider,
  EmailSendOptions,
  SendGridProviderOptions,
} from '../../../interfaces';

export class SendGridEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(options: SendGridProviderOptions) {
    this.apiKey = options.apiKey;
    this.defaultFrom = options.from;
  }

  async send(options: EmailSendOptions): Promise<void> {
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

    const personalizations = [
      {
        to: toAddresses.map((email) => ({ email })),
      },
    ];

    const body: Record<string, unknown> = {
      personalizations,
      from: { email: options.from ?? this.defaultFrom },
      subject: options.subject,
      content: [
        { type: 'text/html', value: options.html },
        ...(options.text
          ? [{ type: 'text/plain', value: options.text }]
          : []),
      ],
    };

    if (options.replyTo) {
      body['reply_to'] = { email: options.replyTo };
    }

    const payload = JSON.stringify(body);

    return new Promise<void>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.sendgrid.com',
          path: '/v3/mail/send',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`SendGrid API error (${res.statusCode}): ${data}`));
            }
          });
        },
      );

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}

import * as https from 'https';
import type {
  SmsProvider,
  SmsSendOptions,
  TwilioProviderOptions,
} from '../../../interfaces';

export class TwilioSmsProvider implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly defaultFrom: string;

  constructor(options: TwilioProviderOptions) {
    this.accountSid = options.accountSid;
    this.authToken = options.authToken;
    this.defaultFrom = options.from;
  }

  async send(options: SmsSendOptions): Promise<void> {
    const from = options.from ?? this.defaultFrom;

    const params = new URLSearchParams();
    params.append('To', options.to);
    params.append('From', from);
    params.append('Body', options.body);

    const payload = params.toString();
    const credentials = Buffer.from(
      `${this.accountSid}:${this.authToken}`,
    ).toString('base64');

    return new Promise<void>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.twilio.com',
          path: `/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
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
              reject(new Error(`Twilio API error (${res.statusCode}): ${data}`));
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

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
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append('To', options.to);
    params.append('From', from);
    params.append('Body', options.body);

    const credentials = Buffer.from(
      `${this.accountSid}:${this.authToken}`,
    ).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Twilio API error (${response.status}): ${errorBody}`,
      );
    }
  }
}

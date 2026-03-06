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

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `SendGrid API error (${response.status}): ${errorBody}`,
      );
    }
  }
}

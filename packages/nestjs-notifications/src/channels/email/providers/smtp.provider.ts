import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type {
  EmailProvider,
  EmailSendOptions,
  SmtpProviderOptions,
} from '../../../interfaces';

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly defaultFrom: string;

  constructor(options: SmtpProviderOptions) {
    this.defaultFrom = options.from;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure ?? false,
      auth: options.auth
        ? { user: options.auth.user, pass: options.auth.pass }
        : undefined,
    });
  }

  async send(options: EmailSendOptions): Promise<void> {
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    await this.transporter.sendMail({
      from: options.from ?? this.defaultFrom,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  }
}

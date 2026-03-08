import { Logger } from '@nestjs/common';
import type { SmsProvider, SmsSendOptions } from '../../../interfaces';

export class LogSmsProvider implements SmsProvider {
  private readonly logger = new Logger(LogSmsProvider.name);

  async send(options: SmsSendOptions): Promise<void> {
    this.logger.log(
      `[LOG] SMS to=${options.to} from=${options.from ?? 'default'} body="${options.body}"`,
    );
  }
}

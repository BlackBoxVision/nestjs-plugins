import { Logger } from '@nestjs/common';
import type { PushProvider, PushSendOptions } from '../../../interfaces';

export class LogPushProvider implements PushProvider {
  private readonly logger = new Logger(LogPushProvider.name);

  async send(options: PushSendOptions): Promise<void> {
    this.logger.log(
      `[LOG] Push token=${options.token} title="${options.title}" body="${options.body}"`,
    );
  }
}

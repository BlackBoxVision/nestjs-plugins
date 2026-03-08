import { IsBoolean, IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertPreferenceDto {
  @ApiProperty({ description: 'Notification channel (e.g., "email", "push", "sms")' })
  @IsIn(['email', 'sms', 'push', 'in_app'])
  channel!: string;

  @ApiProperty({ description: 'Notification type (e.g., "marketing", "transactional")' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Whether this notification type is enabled for this channel' })
  @IsBoolean()
  enabled!: boolean;
}

import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Device push notification token' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'Device platform (e.g., "ios", "android", "web")' })
  @IsIn(['ios', 'android', 'web'])
  platform!: string;
}

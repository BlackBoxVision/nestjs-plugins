import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@bbv/nestjs-pagination';

export class NotificationQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by notification status',
    enum: ['pending', 'sent', 'read', 'failed'],
  })
  @IsEnum(['pending', 'sent', 'read', 'failed'])
  @IsOptional()
  status?: string;
}

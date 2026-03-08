import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export class FilterableDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search term to filter results' })
  @IsString()
  @IsOptional()
  search?: string;
}

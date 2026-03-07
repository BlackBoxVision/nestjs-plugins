import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationDto {
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  page: number = 0;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder: SortOrder = SortOrder.DESC;

  get skip(): number {
    return this.page * this.limit;
  }

  get take(): number {
    return this.limit;
  }
}

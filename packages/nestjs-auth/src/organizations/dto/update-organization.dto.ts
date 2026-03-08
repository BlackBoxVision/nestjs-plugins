import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Organization name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (lowercase, numbers, hyphens only)',
    example: 'my-org',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ description: 'Organization logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;
}

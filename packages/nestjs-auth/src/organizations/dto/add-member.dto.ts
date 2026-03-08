import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiProperty({ description: 'User ID to add as member' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ description: 'Role within the organization', default: 'member' })
  @IsString()
  @IsOptional()
  role?: string;
}

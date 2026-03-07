import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export function createPaginatedResponseDto<T extends Type>(classRef: T) {
  class PaginatedResponseSchema {
    @ApiProperty({ type: Boolean })
    success!: boolean;

    @ApiProperty({ type: [classRef] })
    data!: InstanceType<T>[];

    @ApiProperty({ type: Object, nullable: true })
    errors!: Record<string, string[]> | null;

    @ApiProperty({ type: Number })
    total!: number;

    @ApiProperty({ type: Number })
    page!: number;

    @ApiProperty({ type: Number })
    limit!: number;
  }

  Object.defineProperty(PaginatedResponseSchema, 'name', {
    value: `Paginated${classRef.name}Response`,
  });

  return PaginatedResponseSchema;
}

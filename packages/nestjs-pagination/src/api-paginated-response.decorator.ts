import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath, ApiExtraModels } from '@nestjs/swagger';

export function ApiPaginatedResponse<T extends Type>(model: T) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          errors: { type: 'object', nullable: true, example: null },
          total: { type: 'number', example: 50 },
          page: { type: 'number', example: 0 },
          limit: { type: 'number', example: 10 },
        },
      },
    }),
  );
}

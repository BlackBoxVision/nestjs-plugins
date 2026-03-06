# @bbv/nestjs-pagination

> Pagination utilities for NestJS with Prisma integration and Swagger support.

## Overview

Lightweight utility package providing a validated `PaginationDto` for query params, a `paginate()` helper that runs Prisma `findMany` + `count` in parallel, and an `@ApiPaginatedResponse()` Swagger decorator for typed paginated endpoint documentation. No module registration required.

## Installation

```bash
npm install @bbv/nestjs-pagination
```

### Peer Dependencies

| Package | Version |
|---------|---------|
| `@nestjs/common` | `^10.0.0` |
| `@nestjs/swagger` | `^7.0.0` |

### Dependencies

`class-validator` `^0.14.0`, `class-transformer` `^0.5.1`

## Quick Start

### Controller

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { PaginationDto, ApiPaginatedResponse } from '@bbv/nestjs-pagination';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiPaginatedResponse(ItemEntity)
  findAll(@Query() pagination: PaginationDto) {
    return this.itemsService.findAll(pagination);
  }
}
```

### Service with Prisma

```typescript
import { Injectable } from '@nestjs/common';
import { paginate, PaginationDto, PaginatedResponseDto } from '@bbv/nestjs-pagination';
import { PrismaService } from '@bbv/nestjs-prisma';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<Item>> {
    return paginate<Item>({
      model: this.prisma.item,
      pagination,
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });
  }
}
```

## API Reference

### `PaginationDto`

Query parameter DTO with validation and Swagger annotations.

| Property | Type | Default | Constraints | Description |
|----------|------|---------|-------------|-------------|
| `page` | `number` | `1` | `>= 1`, integer | Current page number |
| `limit` | `number` | `20` | `1-100`, integer | Items per page |
| `skip` | `number` | computed | readonly getter | `(page - 1) * limit` |
| `take` | `number` | computed | readonly getter | Same as `limit` |

Both `page` and `limit` are optional -- defaults are applied automatically. The `skip` and `take` getters are convenience properties for direct use with Prisma.

### `paginate<T>(options)`

Executes `findMany` and `count` in parallel and returns a `PaginatedResponseDto<T>`.

```typescript
async function paginate<T, TWhereInput = Record<string, unknown>>(
  options: PaginateOptions<TWhereInput>,
): Promise<PaginatedResponseDto<T>>
```

**`PaginateOptions`**:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `model` | `{ findMany, count }` | Yes | Prisma model delegate |
| `pagination` | `PaginationDto` | Yes | Pagination parameters |
| `where` | `TWhereInput` | No | Prisma where filter |
| `orderBy` | `Record \| Array` | No | Sort order |
| `include` | `Record` | No | Prisma include relations |
| `select` | `Record` | No | Prisma field selection |

### `PaginatedResponseDto<T>`

Response wrapper returned by `paginate()`.

```typescript
class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMeta;
}
```

### `PaginationMeta`

Metadata computed from total count and pagination params.

| Property | Type | Description |
|----------|------|-------------|
| `total` | `number` | Total record count |
| `page` | `number` | Current page |
| `limit` | `number` | Items per page |
| `totalPages` | `number` | `ceil(total / limit)` |
| `hasPreviousPage` | `boolean` | `page > 1` |
| `hasNextPage` | `boolean` | `page < totalPages` |

### `@ApiPaginatedResponse(Model)`

Swagger decorator that generates proper OpenAPI schema for paginated endpoints.

```typescript
@Get()
@ApiPaginatedResponse(UserEntity)
findAll(@Query() pagination: PaginationDto) { ... }
```

Produces a Swagger response schema with `data` as an array of `Model` and `meta` as `PaginationMeta`.

## Response Shape

```json
{
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

## License

[MIT](../../LICENSE) -- [BlackBox Vision](https://github.com/BlackBoxVision)

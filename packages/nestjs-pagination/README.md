# @bbv/nestjs-pagination

Pagination utilities for NestJS with Swagger support. Provides DTOs, a Prisma-compatible `paginate()` helper, and an `@ApiPaginatedResponse()` decorator.

## Installation

```bash
npm install @bbv/nestjs-pagination
```

**Peer dependencies:** `@nestjs/common`, `@nestjs/swagger`

## Usage

### Controller

```typescript
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
import { paginate, PaginationDto, PaginatedResponseDto } from '@bbv/nestjs-pagination';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<Item>> {
    return paginate<Item>({
      model: this.prisma.item,
      pagination,
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

### Response Shape

```json
{
  "data": [{ "id": "1", "name": "Item 1" }],
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

## API

| Export | Description |
|--------|-------------|
| `PaginationDto` | Query DTO with `page` (default: 1), `limit` (default: 20, max: 100) |
| `PaginatedResponseDto<T>` | Response wrapper with `data` array and `meta` object |
| `paginate<T>(options)` | Helper that runs `findMany` + `count` in parallel |
| `@ApiPaginatedResponse(Model)` | Swagger decorator for paginated endpoints |

## License

[MIT](./LICENSE)

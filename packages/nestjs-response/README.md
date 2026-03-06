# @bbv/nestjs-response

Standardized API response wrapper, transform interceptor, and exception filter for NestJS.

## Installation

```bash
npm install @bbv/nestjs-response
```

**Peer dependencies:** `@nestjs/common`, `@nestjs/core`

## Usage

### Setup in main.ts

```typescript
import { TransformInterceptor, HttpExceptionFilter } from '@bbv/nestjs-response';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(3000);
}
```

### Success Response

All responses are automatically wrapped:

```json
{
  "success": true,
  "data": { "id": "1", "name": "Item" },
  "timestamp": "2026-03-06T12:00:00.000Z"
}
```

### Error Response

Exceptions are caught and formatted consistently:

```json
{
  "success": false,
  "data": null,
  "message": "Item not found",
  "statusCode": 404,
  "timestamp": "2026-03-06T12:00:00.000Z"
}
```

### Manual Response

```typescript
import { ApiResponse } from '@bbv/nestjs-response';

@Get(':id')
findOne(@Param('id') id: string) {
  const item = this.service.findOne(id);
  return ApiResponse.ok(item, 'Item retrieved successfully');
}
```

## API

| Export | Description |
|--------|-------------|
| `ApiResponse<T>` | Response wrapper with `ok()` and `error()` static methods |
| `TransformInterceptor` | Auto-wraps responses in `ApiResponse` |
| `HttpExceptionFilter` | Catches all exceptions, returns consistent error format |

## License

[MIT](./LICENSE)

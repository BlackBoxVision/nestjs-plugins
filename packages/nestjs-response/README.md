# @bbv/nestjs-response

> Standardized API response wrapper, transform interceptor, and exception filter for NestJS.

## Overview

Ensures every API response follows a consistent `{ success, data, message, timestamp }` envelope. The `TransformInterceptor` auto-wraps controller return values, and the `HttpExceptionFilter` catches all exceptions (including unhandled errors) and formats them uniformly. No module registration required -- just register globally in `main.ts`.

## Installation

```bash
npm install @bbv/nestjs-response
```

### Peer Dependencies

| Package | Version |
|---------|---------|
| `@nestjs/common` | `^10.0.0` |
| `@nestjs/core` | `^10.0.0` |

## Quick Start

Register both the interceptor and filter globally in your `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { TransformInterceptor, HttpExceptionFilter } from '@bbv/nestjs-response';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(3000);
}
bootstrap();
```

That's it. All responses are now wrapped automatically.

## API Reference

### `ApiResponse<T>`

Generic response wrapper class.

| Property | Type | Description |
|----------|------|-------------|
| `success` | `boolean` | `true` for success, `false` for errors |
| `data` | `T` | Response payload |
| `message` | `string?` | Optional message |
| `timestamp` | `string` | ISO 8601 timestamp |

**Static methods**:

```typescript
// Create a success response
ApiResponse.ok<T>(data: T, message?: string): ApiResponse<T>

// Create an error response
ApiResponse.error<T = null>(message: string, data?: T): ApiResponse<T | null>
```

**Usage in controllers** (optional -- the interceptor does this automatically):

```typescript
import { ApiResponse } from '@bbv/nestjs-response';

@Get(':id')
findOne(@Param('id') id: string) {
  const item = this.service.findOne(id);
  return ApiResponse.ok(item, 'Item retrieved successfully');
}
```

### `TransformInterceptor`

NestJS interceptor that wraps all controller return values in `ApiResponse.ok()`. If the handler already returns an `ApiResponse` instance, it passes through unchanged.

**Behavior**:
- Controller returns `{ id: '1' }` --> response becomes `{ success: true, data: { id: '1' }, timestamp: '...' }`
- Controller returns `ApiResponse.ok(data, 'msg')` --> passes through as-is

### `HttpExceptionFilter`

Global exception filter that catches **all** exceptions (not just `HttpException`) and returns a consistent error envelope.

**Response shape**:

```json
{
  "success": false,
  "data": null,
  "message": "Item not found",
  "errors": ["field must be a string", "field is required"],
  "timestamp": "2026-03-06T12:00:00.000Z",
  "statusCode": 404
}
```

**Behavior by exception type**:

| Exception Type | Status Code | Message Source |
|---------------|-------------|----------------|
| `HttpException` | From exception | Exception response body or message |
| `Error` | 500 | `error.message` (logged with stack trace) |
| Unknown | 500 | `"Internal server error"` |

For validation errors (class-validator `BadRequestException`), the `errors` array contains all validation messages, and `message` contains the first one.

## Response Shapes

### Success

```json
{
  "success": true,
  "data": { "id": "1", "name": "Item" },
  "timestamp": "2026-03-06T12:00:00.000Z"
}
```

### Error

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed",
  "errors": ["email must be an email", "password must be at least 8 characters"],
  "statusCode": 400,
  "timestamp": "2026-03-06T12:00:00.000Z"
}
```

### Manual Error

```typescript
import { ApiResponse } from '@bbv/nestjs-response';

const errorResponse = ApiResponse.error('Operation failed', { field: 'email' });
// { success: false, data: { field: 'email' }, message: 'Operation failed', timestamp: '...' }
```

## License

[MIT](../../LICENSE) -- [BlackBox Vision](https://github.com/BlackBoxVision)

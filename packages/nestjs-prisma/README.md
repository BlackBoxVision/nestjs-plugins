# @bbv/nestjs-prisma

NestJS module for Prisma with lifecycle management, soft-delete middleware, and testing utilities.

## Installation

```bash
npm install @bbv/nestjs-prisma
```

**Peer dependencies:** `@nestjs/common`, `@nestjs/core`, `@prisma/client`

## Usage

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '@bbv/nestjs-prisma';

@Module({
  imports: [
    PrismaModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}
```

### Async Configuration

```typescript
PrismaModule.forRootAsync({
  isGlobal: true,
  useFactory: () => ({
    prismaServiceOptions: {
      explicitConnect: true,
    },
  }),
})
```

### Inject PrismaService

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bbv/nestjs-prisma';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }
}
```

### Soft Delete Middleware

```typescript
import { PrismaModule, softDeleteMiddleware } from '@bbv/nestjs-prisma';

PrismaModule.forRoot({
  isGlobal: true,
  prismaServiceOptions: {
    middlewares: [softDeleteMiddleware],
  },
})
```

### Testing

```typescript
import { createMockPrismaService } from '@bbv/nestjs-prisma';

const mockPrisma = createMockPrismaService();
mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
```

## API

| Export | Description |
|--------|-------------|
| `PrismaModule` | Dynamic module with `forRoot()` / `forRootAsync()` |
| `PrismaService` | Lifecycle-managed Prisma client singleton |
| `softDeleteMiddleware` | Prisma middleware for `deletedAt` soft-delete pattern |
| `createMockPrismaService()` | Deeply mocked PrismaService for unit tests |

## License

[MIT](./LICENSE)

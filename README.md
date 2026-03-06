# @bbv/nestjs-plugins

Composable NestJS plugin ecosystem by [BlackBox Vision](https://github.com/BlackBoxVision).

Each module is a self-contained feature -- own Prisma schema, feature flags, provider abstraction -- that you compose into a production-ready NestJS API.

## Architecture

```
  Your NestJS App
  |
  +-- PrismaModule (@bbv/nestjs-prisma)        <-- foundation, all plugins depend on this
  |     |
  |     +-- AuthModule              (@bbv/nestjs-auth)           Tier 1 plugin
  |     +-- NotificationModule      (@bbv/nestjs-notifications)  Tier 1 plugin
  |     +-- StorageModule           (@bbv/nestjs-storage)        Tier 1 plugin
  |     +-- AuditLogModule          (@bbv/nestjs-audit-log)      Tier 1 plugin
  |
  +-- PaginationDto, paginate()    (@bbv/nestjs-pagination)      Tier 2 utility
  +-- TransformInterceptor, Filter (@bbv/nestjs-response)        Tier 2 utility
```

## Packages

### Tier 1 -- Plugin Modules

Own Prisma schema, feature flags, and provider abstraction.

| Package | Description | Docs |
|---------|-------------|------|
| [`@bbv/nestjs-auth`](./packages/nestjs-auth) | Email/password, social login (Google/Apple/Microsoft), organizations, RBAC, sessions | [README](./packages/nestjs-auth/README.md) |
| [`@bbv/nestjs-notifications`](./packages/nestjs-notifications) | Multi-channel notifications (email, in-app, SMS) with BullMQ queues, templates, preferences | [README](./packages/nestjs-notifications/README.md) |
| [`@bbv/nestjs-storage`](./packages/nestjs-storage) | File upload with provider abstraction (S3, Firebase, DO Spaces, Local) and upload tracking | [README](./packages/nestjs-storage/README.md) |
| [`@bbv/nestjs-audit-log`](./packages/nestjs-audit-log) | Automatic CRUD audit logging via Prisma middleware, `@Audited()` decorator, retention policies | [README](./packages/nestjs-audit-log/README.md) |

### Tier 2 -- Utility Packages

No module registration needed. Import and use directly.

| Package | Description | Docs |
|---------|-------------|------|
| [`@bbv/nestjs-prisma`](./packages/nestjs-prisma) | Prisma lifecycle management, soft-delete middleware, `createMockPrismaService()` for testing | [README](./packages/nestjs-prisma/README.md) |
| [`@bbv/nestjs-pagination`](./packages/nestjs-pagination) | `PaginationDto`, `paginate()` helper, `@ApiPaginatedResponse()` Swagger decorator | [README](./packages/nestjs-pagination/README.md) |
| [`@bbv/nestjs-response`](./packages/nestjs-response) | `ApiResponse` wrapper, `TransformInterceptor`, `HttpExceptionFilter` | [README](./packages/nestjs-response/README.md) |

## How It Works

### Feature Flags

Every plugin module accepts a `features` config to toggle capabilities. Disabled features don't register routes, don't consume resources, and throw if called directly.

```typescript
AuthModule.forRootAsync({
  useFactory: () => ({
    jwt: { secret: 'my-secret' },
    features: {
      emailPassword: true,     // POST /auth/register, POST /auth/login
      google: false,            // Google OAuth routes not registered
      organizations: true,      // Full /organizations CRUD
      sessionManagement: false,  // Session endpoints not registered
    },
  }),
})
```

### Provider Abstraction

Modules with swappable backends follow the same config pattern with TypeScript discriminated unions for type safety:

```typescript
StorageModule.forRoot({
  provider: 's3',                    // or 'firebase', 'do_spaces', 'local'
  providerOptions: { /* typed */ },  // type narrows based on provider
})
```

### Multi-File Prisma Schema

Each Tier 1 plugin ships a `.prisma` file. Copy them into your project's schema directory:

```
prisma/schema/
  base.prisma           # datasource + generator (with prismaSchemaFolder)
  auth.prisma           # from @bbv/nestjs-auth
  notifications.prisma  # from @bbv/nestjs-notifications
  storage.prisma        # from @bbv/nestjs-storage
  audit.prisma          # from @bbv/nestjs-audit-log
  app.prisma            # your project-specific models
```

`base.prisma`:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Quick Start

### 1. Install packages

```bash
npm install @bbv/nestjs-prisma @bbv/nestjs-auth @bbv/nestjs-storage @bbv/nestjs-notifications @bbv/nestjs-audit-log
```

### 2. Configure modules

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@bbv/nestjs-prisma';
import { AuthModule } from '@bbv/nestjs-auth';
import { StorageModule } from '@bbv/nestjs-storage';
import { NotificationModule } from '@bbv/nestjs-notifications';
import { AuditLogModule } from '@bbv/nestjs-audit-log';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule.forRoot({ isGlobal: true }),

    AuthModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        jwt: { secret: config.getOrThrow('JWT_SECRET') },
        features: { emailPassword: true, google: true, organizations: true },
        providers: {
          google: {
            clientId: config.getOrThrow('GOOGLE_CLIENT_ID'),
            clientSecret: config.getOrThrow('GOOGLE_CLIENT_SECRET'),
            callbackUrl: '/auth/google/callback',
          },
        },
      }),
      inject: [ConfigService],
    }),

    StorageModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        provider: 's3',
        providerOptions: {
          accessKeyId: config.getOrThrow('S3_ACCESS_KEY'),
          secretAccessKey: config.getOrThrow('S3_SECRET_KEY'),
          bucket: config.getOrThrow('S3_BUCKET'),
        },
        features: { trackUploads: true, signedUrls: true },
      }),
      inject: [ConfigService],
    }),

    NotificationModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        channels: {
          email: {
            enabled: true, provider: 'smtp',
            providerOptions: { host: config.get('SMTP_HOST', 'localhost'), port: 587, from: 'noreply@app.com' },
          },
          inApp: { enabled: true },
        },
        queue: { redis: { host: config.get('REDIS_HOST', 'localhost') } },
      }),
      inject: [ConfigService],
    }),

    AuditLogModule.forRoot({
      features: { autoTrackCrud: true, registerController: true },
    }),
  ],
})
export class AppModule {}
```

### 3. Copy Prisma schemas and migrate

```bash
cp node_modules/@bbv/nestjs-auth/prisma/auth.prisma prisma/schema/
cp node_modules/@bbv/nestjs-notifications/prisma/notifications.prisma prisma/schema/
cp node_modules/@bbv/nestjs-storage/prisma/storage.prisma prisma/schema/
cp node_modules/@bbv/nestjs-audit-log/prisma/audit.prisma prisma/schema/

npx prisma generate
npx prisma migrate dev
```

### 4. Set up response envelope (optional)

```typescript
// main.ts
import { TransformInterceptor, HttpExceptionFilter } from '@bbv/nestjs-response';

app.useGlobalInterceptors(new TransformInterceptor());
app.useGlobalFilters(new HttpExceptionFilter());
```

## Development

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run build` | Build all packages |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all packages |
| `npm run typecheck` | Type-check all packages |
| `npm run format` | Format with Prettier |
| `cd apps/demo && npm run dev` | Run demo app (Swagger at `http://localhost:3000/api`) |

Demo app setup:
```bash
cd apps/demo
npm run docker        # Start Postgres + Redis
npm run setup         # prisma generate + migrate
npm run dev           # http://localhost:3000/api (Swagger)
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat(package): add feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

We use [Changesets](https://github.com/changesets/changesets) for versioning. Add a changeset with `npx changeset` before submitting your PR.

## License

[MIT](./LICENSE) -- [BlackBox Vision](https://github.com/BlackBoxVision)

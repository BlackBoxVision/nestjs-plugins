# @bbv/nestjs-plugins

Composable NestJS plugin ecosystem by [BlackBox Vision](https://github.com/BlackBoxVision). Each module is a self-contained feature with its own Prisma schema, feature flags, and provider abstractions — like NestJS plugins that bring their own DB tables, config, and toggleable capabilities.

Build a production-ready NestJS API by composing modules: `AuthModule`, `NotificationModule`, `StorageModule` — each bringing its schema, migrations, and feature set.

## Packages

### Tier 1 — Plugin Modules (own Prisma schema + feature flags)

| Package | Description | Version |
|---------|-------------|---------|
| [`@bbv/nestjs-auth`](./packages/nestjs-auth) | Authentication, social login, organizations, RBAC | [![npm](https://img.shields.io/npm/v/@bbv/nestjs-auth.svg)](https://www.npmjs.com/package/@bbv/nestjs-auth) |
| [`@bbv/nestjs-notifications`](./packages/nestjs-notifications) | Multi-channel notifications (email, in-app, SMS) | [![npm](https://img.shields.io/npm/v/@bbv/nestjs-notifications.svg)](https://www.npmjs.com/package/@bbv/nestjs-notifications) |
| [`@bbv/nestjs-storage`](./packages/nestjs-storage) | File storage with provider abstraction (S3, Firebase, DO Spaces, Local) | [![npm](https://img.shields.io/npm/v/@bbv/nestjs-storage.svg)](https://www.npmjs.com/package/@bbv/nestjs-storage) |
| [`@bbv/nestjs-audit-log`](./packages/nestjs-audit-log) | Automatic audit logging with Prisma middleware | [![npm](https://img.shields.io/npm/v/@bbv/nestjs-audit-log.svg)](https://www.npmjs.com/package/@bbv/nestjs-audit-log) |

### Tier 2 — Utility Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@bbv/nestjs-prisma`](./packages/nestjs-prisma) | Prisma service shell, lifecycle management, test utilities | [![npm](https://img.shields.io/npm/v/@bbv/nestjs-prisma.svg)](https://www.npmjs.com/package/@bbv/nestjs-prisma) |
| [`@bbv/nestjs-pagination`](./packages/nestjs-pagination) | Pagination DTOs, helpers, and Swagger decorators | [![npm](https://img.shields.io/npm/v/@bbv/nestjs-pagination.svg)](https://www.npmjs.com/package/@bbv/nestjs-pagination) |
| [`@bbv/nestjs-response`](./packages/nestjs-response) | API response wrapper, transform interceptor, exception filter | [![npm](https://img.shields.io/npm/v/@bbv/nestjs-response.svg)](https://www.npmjs.com/package/@bbv/nestjs-response) |

## Quick Start

```bash
npm install @bbv/nestjs-prisma @bbv/nestjs-auth @bbv/nestjs-storage @bbv/nestjs-notifications
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@bbv/nestjs-prisma';
import { AuthModule } from '@bbv/nestjs-auth';
import { StorageModule } from '@bbv/nestjs-storage';
import { NotificationModule } from '@bbv/nestjs-notifications';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule.forRoot({ isGlobal: true }),

    AuthModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        jwt: { secret: config.getOrThrow('JWT_SECRET') },
        features: {
          emailPassword: true,
          google: true,
          organizations: true,
          emailVerification: true,
          passwordReset: true,
        },
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
          endpoint: config.get('S3_ENDPOINT'),
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
            enabled: true,
            provider: 'smtp',
            providerOptions: {
              host: config.get('SMTP_HOST', 'localhost'),
              port: 587,
              from: 'noreply@app.com',
            },
          },
          inApp: { enabled: true },
        },
        queue: { redis: { host: config.get('REDIS_HOST', 'localhost') } },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

Then copy plugin Prisma schemas and run migrations:

```bash
# Copy plugin schemas (one-time, version-control these)
cp node_modules/@bbv/nestjs-auth/prisma/auth.prisma prisma/schema/
cp node_modules/@bbv/nestjs-notifications/prisma/notifications.prisma prisma/schema/
cp node_modules/@bbv/nestjs-storage/prisma/storage.prisma prisma/schema/

# Generate client + migrate
npx prisma generate
npx prisma migrate dev
```

## Multi-File Prisma Schema

Each Tier 1 plugin ships a `.prisma` file. Your project uses Prisma's native multi-file schema support:

```
prisma/
  schema/
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

## Feature Flags

Every plugin module accepts a `features` config to toggle capabilities:

```typescript
AuthModule.forRootAsync({
  useFactory: () => ({
    jwt: { secret: 'my-secret' },
    features: {
      emailPassword: true,   // POST /auth/register, POST /auth/login
      google: false,          // Google OAuth routes not registered
      organizations: true,    // Full /organizations CRUD
      sessionManagement: false, // Session endpoints not registered
    },
  }),
})
```

When a feature is off:
- Its routes are **not registered**
- Its services **throw** if called directly
- No runtime overhead

## Provider Abstraction

All modules with swappable providers follow the same config pattern:

```typescript
{
  provider: 'provider_name',
  providerOptions: { /* typed config for that provider */ },
}
```

TypeScript discriminated unions ensure type safety per provider.

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test

# Lint all packages
npm run lint

# Type-check all packages
npm run typecheck

# Run the demo app
cd apps/demo
npm run docker        # start Postgres + Redis
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

[MIT](./LICENSE) - BlackBox Vision

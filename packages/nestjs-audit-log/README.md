# @bbv/nestjs-audit-log

> Automatic audit logging for NestJS with Prisma middleware, request context tracking, and an `@Audited()` decorator.

## Overview

Tracks create, update, and delete operations automatically via Prisma middleware, capturing the user, IP address, user agent, and entity changes. Provides an `@Audited()` decorator for explicit route-level audit logging, an `AuditLogService` for manual entries, and an optional REST controller for querying audit history. Sensitive fields are automatically redacted.

## Installation

```bash
npm install @bbv/nestjs-audit-log
```

### Peer Dependencies

| Package | Version |
|---------|---------|
| `@nestjs/common` | `^10.0.0` |
| `@nestjs/core` | `^10.0.0` |
| `@prisma/client` | `^5.0.0 \|\| ^6.0.0` |

Requires [`@bbv/nestjs-prisma`](../nestjs-prisma) to be registered first.

## Prisma Schema

Copy the audit schema into your project:

```bash
cp node_modules/@bbv/nestjs-audit-log/prisma/audit.prisma prisma/schema/
npx prisma generate && npx prisma migrate dev
```

**Models provided**:

| Model | Key Fields | Description |
|-------|-----------|-------------|
| `AuditLog` | `userId?`, `action`, `entity?`, `entityId?`, `changes?` (JSON), `metadata?` (JSON), `ipAddress?`, `userAgent?` | Audit trail entries |

Indexed on: `userId`, `entity + entityId`, `action`, `createdAt`.

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { AuditLogModule } from '@bbv/nestjs-audit-log';

@Module({
  imports: [
    AuditLogModule.forRoot({
      features: {
        autoTrackCrud: true,
        trackChanges: true,
        registerController: true,
        retention: 90, // auto-delete logs older than 90 days
      },
      excludeEntities: ['Session', 'VerificationToken'],
      excludeFields: ['passwordHash', 'refreshToken', 'accessToken'],
    }),
  ],
})
export class AppModule {}
```

The module registers globally by default.

## Configuration

### `AuditLogModuleOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `features.autoTrackCrud` | `boolean` | `true` | Auto-log create/update/delete via Prisma middleware |
| `features.trackAuthEvents` | `boolean` | `true` | Log login, logout, failed attempts |
| `features.trackChanges` | `boolean` | `true` | Store old/new values for update operations |
| `features.registerController` | `boolean` | `false` | Mount `GET /audit-logs` REST endpoints |
| `features.retention` | `number \| null` | `null` | Auto-delete logs older than N days |
| `excludeEntities` | `string[]` | `[]` | Models to skip in auto-tracking |
| `excludeFields` | `string[]` | `['password', 'hash', 'token', 'secret']` | Fields to redact from logged data |
| `adminRoles` | `string[]` | `[]` | Roles allowed to access audit log endpoints |

## Auto CRUD Tracking

When `autoTrackCrud` is enabled, register the Prisma audit middleware:

```typescript
import { createAuditMiddleware } from '@bbv/nestjs-audit-log';

// In your PrismaService or module setup
prisma.$use(createAuditMiddleware(auditLogService, options));
```

This automatically logs:

| Prisma Action | Audit Action | Data Captured |
|---------------|-------------|---------------|
| `create` | `CREATE` | Sanitized input data, new entity ID |
| `update` | `UPDATE` | Changed fields with old/new values (if `trackChanges`) |
| `delete` | `DELETE` | Deleted entity data |

**Request context** (userId, IP, user agent) is captured via `AsyncLocalStorage` through the `AuditContextMiddleware`, which is applied to all routes automatically.

## `@Audited()` Decorator

For explicit route-level audit logging:

```typescript
import { Audited } from '@bbv/nestjs-audit-log';

@Controller('claims')
export class ClaimsController {
  @Audited('approve_claim')         // custom action name
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    // ...
  }

  @Audited()                        // defaults to "ClaimsController.reject"
  @Post(':id/reject')
  reject(@Param('id') id: string) {
    // ...
  }
}
```

The `@Audited()` decorator:
- Wraps the route handler with `AuditedInterceptor`
- Captures the request method, URL, params, and query in metadata
- Extracts entity and entityId from route params (`:id`)
- Gets user context from `AsyncLocalStorage` or `request.user`

## Manual Logging

```typescript
import { Injectable } from '@nestjs/common';
import { AuditLogService } from '@bbv/nestjs-audit-log';

@Injectable()
export class ClaimsService {
  constructor(private readonly auditLog: AuditLogService) {}

  async approveClaim(id: string, userId: string) {
    // ... approval logic ...

    await this.auditLog.log({
      userId,
      action: 'APPROVE',
      entity: 'Claim',
      entityId: id,
      metadata: { reason: 'Meets warranty criteria' },
    });
  }
}
```

### `AuditLogEntry`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | No | User who performed the action |
| `action` | `string` | Yes | Action name (e.g. `CREATE`, `APPROVE`) |
| `entity` | `string` | No | Entity/model name |
| `entityId` | `string` | No | Entity ID |
| `changes` | `Record<string, { old, new }>` | No | Field-level change tracking |
| `metadata` | `Record<string, unknown>` | No | Additional context |
| `ipAddress` | `string` | No | Client IP address |
| `userAgent` | `string` | No | Client user agent |

## API Reference

### `AuditLogService`

| Method | Signature | Description |
|--------|-----------|-------------|
| `log` | `(entry: AuditLogEntry) => void` | Create audit log entry |
| `findAll` | `(options?: AuditLogQueryOptions) => { data, total, page, limit, totalPages }` | Query logs with filters and pagination |
| `findById` | `(id: string) => AuditLog` | Get single log entry |
| `findByEntity` | `(entity, entityId) => AuditLog[]` | Get entity change history |
| `findByUser` | `(userId, options?) => { data, total, ... }` | Get user's audit trail |
| `cleanup` | `(olderThanDays: number) => number` | Delete old entries, returns count |

### `AuditLogQueryOptions`

| Option | Type | Description |
|--------|------|-------------|
| `userId` | `string` | Filter by user |
| `entity` | `string` | Filter by entity type |
| `entityId` | `string` | Filter by entity ID |
| `action` | `string` | Filter by action |
| `startDate` | `Date` | Filter from date |
| `endDate` | `Date` | Filter to date |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Page size (default: 20) |

### REST Endpoints

When `features.registerController` is enabled:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit-logs` | List logs with query filters |
| `GET` | `/audit-logs/:id` | Get single log entry |
| `GET` | `/audit-logs/entity/:entity/:entityId` | Get entity change history |

**Query parameters** for `GET /audit-logs`: `userId`, `entity`, `entityId`, `action`, `startDate`, `endDate`, `page`, `limit`.

## Architecture

```
AuditLogModule (global)
  forRoot() / forRootAsync()
  |
  +-- AuditContextMiddleware       -- captures userId, IP, UA via AsyncLocalStorage
  |     (applied to all routes)
  |
  +-- createAuditMiddleware()      -- Prisma $use middleware for auto CRUD tracking
  |     +-- excludes configured entities/fields
  |     +-- sanitizes sensitive data ([REDACTED])
  |     +-- tracks old/new values on updates
  |
  +-- @Audited() decorator         -- route-level audit via AuditedInterceptor
  |
  +-- AuditLogService              -- log(), findAll(), findByEntity(), cleanup()
  +-- AuditLogController           -- opt-in REST API for querying logs
```

## License

[MIT](../../LICENSE) -- [BlackBox Vision](https://github.com/BlackBoxVision)

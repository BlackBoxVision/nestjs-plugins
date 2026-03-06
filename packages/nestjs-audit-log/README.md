# @bbv/nestjs-audit-log

Automatic activity and audit logging for NestJS. Tracks user actions, entity changes, and auth events via Prisma middleware. Useful for compliance, debugging, and admin visibility.

## Installation

```bash
npm install @bbv/nestjs-audit-log
```

**Peer dependencies:** `@nestjs/common`, `@nestjs/core`, `@prisma/client`

## Prisma Schema

```bash
cp node_modules/@bbv/nestjs-audit-log/prisma/audit.prisma prisma/schema/
npx prisma generate && npx prisma migrate dev
```

Provides: `AuditLog`

## Usage

```typescript
import { AuditLogModule } from '@bbv/nestjs-audit-log';

@Module({
  imports: [
    AuditLogModule.forRootAsync({
      useFactory: () => ({
        features: {
          autoTrackCrud: true,
          trackAuthEvents: true,
          trackChanges: true,
          registerController: true,
          retention: 90, // delete logs older than 90 days
        },
        excludeEntities: ['Session', 'VerificationToken'],
        excludeFields: ['passwordHash', 'refreshToken'],
        adminRoles: ['admin', 'owner'],
      }),
    }),
  ],
})
export class AppModule {}
```

## Feature Flags

| Flag | Default | What it controls |
|------|---------|-----------------|
| `autoTrackCrud` | `true` | Auto-log create/update/delete via Prisma middleware |
| `trackAuthEvents` | `true` | Log login, logout, failed login attempts |
| `trackChanges` | `true` | Store old/new values for updates |
| `registerController` | `true` | `GET /audit-logs` admin endpoint |
| `retention` | `null` | Auto-delete logs older than N days |

## Manual Logging

```typescript
import { AuditLogService } from '@bbv/nestjs-audit-log';

@Injectable()
export class ClaimsService {
  constructor(private readonly auditLog: AuditLogService) {}

  async approveClaim(id: string, userId: string) {
    // ... approve logic
    await this.auditLog.log({
      userId,
      action: 'approve',
      entity: 'Claim',
      entityId: id,
      metadata: { reason: 'Meets criteria' },
    });
  }
}
```

## @Audited Decorator

```typescript
import { Audited } from '@bbv/nestjs-audit-log';

@Controller('claims')
export class ClaimsController {
  @Audited('approve_claim')
  @Post(':id/approve')
  approve(@Param('id') id: string) {}
}
```

## Admin Endpoint

When `registerController` is enabled:
- `GET /audit-logs` — List with filters (`userId`, `entity`, `entityId`, `action`, `startDate`, `endDate`, `page`, `limit`)
- `GET /audit-logs/:id` — Single log entry
- `GET /audit-logs/entity/:entity/:entityId` — Entity history

Protected by `adminRoles` config.

## License

[MIT](./LICENSE)
